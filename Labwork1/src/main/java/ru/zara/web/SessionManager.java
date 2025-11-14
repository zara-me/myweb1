package ru.zara.web;

import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class SessionManager {

    private static final Map<String, List<CalculationResult>> sessions = new ConcurrentHashMap<>();
    private static final String SESSIONS_DIR = "sessions";
    private static final String SESSION_FILE_EXT = ".session";

    static {
        try {
            Path sessionsPath = Paths.get(SESSIONS_DIR);
            if (!Files.exists(sessionsPath)) {
                Files.createDirectories(sessionsPath);
            }
            loadAllSessions();
        } catch (IOException e) {
            System.err.println("Warning: Could not create sessions directory: " + e.getMessage());
        }
    }

    public static class CalculationResult {
        private final double x;
        private final double y;
        private final double r;
        private final boolean isInArea;
        private final String currentTime;
        private final double executionTime;

        public CalculationResult(double x, double y, double r, boolean isInArea,
                                 String currentTime, double executionTime) {
            this.x = x;
            this.y = y;
            this.r = r;
            this.isInArea = isInArea;
            this.currentTime = currentTime;
            this.executionTime = executionTime;
        }

        public double getX() { return x; }
        public double getY() { return y; }
        public double getR() { return r; }
        public boolean isInArea() { return isInArea; }
        public String getCurrentTime() { return currentTime; }
        public double getExecutionTime() { return executionTime; }
    }

    public static List<CalculationResult> getSession(String sessionId) {
        return sessions.computeIfAbsent(sessionId, k -> new ArrayList<>());
    }

    public static void addResult(String sessionId, CalculationResult result) {
        List<CalculationResult> session = getSession(sessionId);
        session.add(result);
        saveSession(sessionId, session);
    }

    public static List<CalculationResult> getResults(String sessionId) {
        List<CalculationResult> session = getSession(sessionId);
        List<CalculationResult> reversed = new ArrayList<>(session);
        Collections.reverse(reversed);
        return reversed;
    }

    private static void loadAllSessions() {
        try {
            Path sessionsPath = Paths.get(SESSIONS_DIR);
            if (!Files.exists(sessionsPath)) {
                return;
            }

            Files.list(sessionsPath)
                    .filter(path -> path.toString().endsWith(SESSION_FILE_EXT))
                    .forEach(SessionManager::loadSession);
        } catch (IOException e) {
            System.err.println("Warning: Could not load sessions: " + e.getMessage());
        }
    }

    private static void loadSession(Path sessionFile) {
        try {
            String sessionId = sessionFile.getFileName().toString().replace(SESSION_FILE_EXT, "");
            List<CalculationResult> results = new ArrayList<>();
            try (BufferedReader reader = Files.newBufferedReader(sessionFile)) {
                String line;
                while ((line = reader.readLine()) != null) {
                    if (!line.trim().isEmpty()) {
                        CalculationResult result = parseResultFromLine(line);
                        if (result != null) results.add(result);
                    }
                }
            }
            if (!results.isEmpty()) sessions.put(sessionId, results);
        } catch (IOException e) {
            System.err.println("Warning: Could not load session from " + sessionFile + ": " + e.getMessage());
        }
    }

    private static CalculationResult parseResultFromLine(String line) {
        try {
            String[] parts = line.split("\\|");
            if (parts.length >= 6) {
                double x = Double.parseDouble(parts[0]);
                double y = Double.parseDouble(parts[1]);
                double r = Double.parseDouble(parts[2]);
                boolean isInArea = Boolean.parseBoolean(parts[3]);
                String currentTime = parts[4];
                double executionTime = Double.parseDouble(parts[5]);
                return new CalculationResult(x, y, r, isInArea, currentTime, executionTime);
            }
        } catch (Exception e) {
            System.err.println("Warning: Could not parse result line: " + line);
        }
        return null;
    }

    private static void saveSession(String sessionId, List<CalculationResult> results) {
        try {
            Path sessionFile = Paths.get(SESSIONS_DIR, sessionId + SESSION_FILE_EXT);
            try (PrintWriter writer = new PrintWriter(Files.newBufferedWriter(sessionFile))) {
                for (CalculationResult result : results) {
                    writer.println(String.format("%.6f|%.6f|%.6f|%s|%s|%.6f",
                            result.getX(), result.getY(), result.getR(),
                            result.isInArea(), result.getCurrentTime(),
                            result.getExecutionTime()));
                }
            }
        } catch (IOException e) {
            System.err.println("Warning: Could not save session " + sessionId + ": " + e.getMessage());
        }
    }
}



//This class is responsible for storing,
// loading, and managing the results of users' calculations,
// and each session is tracked with a unique ID.
// The data is stored both in memory and in the server file so that it can be retrieved even after the application is closed.