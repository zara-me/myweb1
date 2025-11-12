package ru.zara.web;

import com.fastcgi.FCGIInterface;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

public class FastCGIServer {

    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    public static void main(String[] args) {
        // an infinite loop waiting for FCGI requests.
        var fcgi = new FCGIInterface();
        while (fcgi.FCGIaccept() >= 0) {
            try {
                String method = FCGIInterface.request.params.getProperty("REQUEST_METHOD");
                if (method == null) {
                    System.out.println(errorResult("Unsupported HTTP method: null"));
                    continue;
                }
                if ("POST".equalsIgnoreCase(method)) {
                    handlePost();
                } else if ("OPTIONS".equalsIgnoreCase(method)) {
                    // Preflight for CORS
                    System.out.println(optionsResult());
                } else {
                    // Disallow GET for submissions per task; instruct to use POST
                    System.out.println(errorResult("Unsupported HTTP method: " + method + ". Use POST for submissions."));
                }
            } catch (Exception e) {
                System.out.println(errorResult("Internal server error: " + e.getMessage()));
            }
        }
    }

    private static void handlePost() {
        String contentType = FCGIInterface.request.params.getProperty("CONTENT_TYPE");
        if (contentType == null || !contentType.startsWith("application/x-www-form-urlencoded")) {
            System.out.println(errorResult("Content-Type must be application/x-www-form-urlencoded"));
            return;
        }
        String bodyStr = readRequestBody();
        Map<String, String> form = parseQueryString(bodyStr);
        String xStr = form.get("xVal");
        String yStr = form.get("yVal");
        String rStr = form.get("rVal");
        String sessionId = form.get("sessionId");

        if (xStr == null || yStr == null || rStr == null) {
            System.out.println(errorResult("Missing required parameters xVal,yVal,rVal"));
            return;
        }

        double x, y, r;
        long startNano = System.nanoTime();
        try {
            x = Double.parseDouble(xStr);
            y = Double.parseDouble(yStr);
            r = Double.parseDouble(rStr);
        } catch (NumberFormatException e) {
            System.out.println(errorResult("Parameters must be numeric"));
            return;
        }

        CoordinatesValidator validator = new CoordinatesValidator(x, y, r);
        if (!validator.checkData()) {
            System.out.println(errorResult("Validation failed: check ranges for X,Y,R"));
            return;
        }

        boolean inArea = AreaChecker.isInArea(x, y, r);
        long execNano = System.nanoTime() - startNano; // execution time in nanoseconds
        String now = LocalDateTime.now().format(TIME_FMT);

        if (sessionId == null || sessionId.trim().isEmpty()) {
            sessionId = "session_" + System.currentTimeMillis() + "_" + Integer.toHexString((int)(Math.random()*10000));
        } else {
            sessionId = sessionId.trim();
        }

        SessionManager.CalculationResult result = new SessionManager.CalculationResult(
                x, y, r, inArea, now, execNano
        );

        SessionManager.addResult(sessionId, result);

        var allResults = SessionManager.getResults(sessionId);
        String body = buildJsonResponseFromList(allResults);

        System.out.println(successJsonResult(body));
    }

    /*  Utilities */

    private static String readRequestBody() {
        try {
            String contentLengthStr = FCGIInterface.request.params.getProperty("CONTENT_LENGTH");
            if (contentLengthStr == null) return "";
            int contentLength = Integer.parseInt(contentLengthStr);
            if (contentLength <= 0) return "";
            byte[] body = new byte[contentLength];
            int totalRead = 0;
            while (totalRead < contentLength) {
                int r = System.in.read(body, totalRead, contentLength - totalRead);
                if (r == -1) break;
                totalRead += r;
            }
            return new String(body, 0, totalRead, StandardCharsets.UTF_8);
        } catch (Exception e) {
            return "";
        }
    }

    private static Map<String, String> parseQueryString(String qs) {
        Map<String, String> map = new HashMap<>();
        if (qs == null || qs.isEmpty()) return map;
        String[] pairs = qs.split("&");
        for (String pair : pairs) {
            String[] kv = pair.split("=", 2);
            if (kv.length == 2) {
                try {
                    String key = URLDecoder.decode(kv[0], StandardCharsets.UTF_8);
                    String val = URLDecoder.decode(kv[1], StandardCharsets.UTF_8);
                    map.put(key, val);
                } catch (Exception ignored) {}
            }
        }
        return map;
    }

    private static String buildJsonResponseFromList(List<SessionManager.CalculationResult> results) {
        StringBuilder sb = new StringBuilder();
        sb.append("{\"results\":[");
        for (int i = 0; i < results.size(); i++) {
            var r = results.get(i);
            if (i > 0) sb.append(",");
            sb.append("{");
            sb.append("\"x\":").append(r.getX()).append(",");
            sb.append("\"y\":").append(r.getY()).append(",");
            sb.append("\"r\":").append(r.getR()).append(",");
            sb.append("\"isInArea\":").append(r.isInArea()).append(",");
            sb.append("\"currentTime\":\"").append(escapeJson(r.getCurrentTime())).append("\",");
            sb.append("\"executionTime\":").append(r.getExecutionTime());
            sb.append("}");
        }
        sb.append("]}");
        return sb.toString();
    }

    private static String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private static String successJsonResult(String jsonBody) {
        byte[] bytes = jsonBody.getBytes(StandardCharsets.UTF_8);
        int len = bytes.length;
        String headers = "Content-Type: application/json; charset=UTF-8\r\n" +
                "Content-Length: " + len + "\r\n" +
                "Access-Control-Allow-Origin: *\r\n" +
                "Access-Control-Allow-Methods: POST, OPTIONS\r\n" +
                "Access-Control-Allow-Headers: Content-Type\r\n" +
                "\r\n";
        return headers + jsonBody;
    }

    private static String errorResult(String message) {
        String json = "{\"error\":\"" + escapeJson(message) + "\"}";
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        int len = bytes.length;
        String headers = "Status: 400 Bad Request\r\n" +
                "Content-Type: application/json; charset=UTF-8\r\n" +
                "Content-Length: " + len + "\r\n" +
                "Access-Control-Allow-Origin: *\r\n" +
                "Access-Control-Allow-Methods: POST, OPTIONS\r\n" +
                "Access-Control-Allow-Headers: Content-Type\r\n" +
                "\r\n";
        return headers + json;
    }

    private static String optionsResult() {
        String json = "{}";
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        int len = bytes.length;
        String headers = "Content-Type: application/json; charset=UTF-8\r\n" +
                "Content-Length: " + len + "\r\n" +
                "Access-Control-Allow-Origin: *\r\n" +
                "Access-Control-Allow-Methods: POST, OPTIONS\r\n" +
                "Access-Control-Allow-Headers: Content-Type\r\n" +
                "\r\n";
        return headers + json;
    }
}
