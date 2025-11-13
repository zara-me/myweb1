package ru.zara.web;


public class CoordinatesValidator {

    private final double x;
    private final int y; // y is int
    private final double r;

    private static final double X_MIN = -3.0;
    private static final double X_MAX = 5.0;
    // y is int
    private static final int[] VALID_Y_VALUES = {-4, -3, -2, -1, 0, 1, 2, 3, 4};
    // R
    private static final double R_MIN = 2.0;
    private static final double R_MAX = 5.0;

    public CoordinatesValidator(double x, int y, double r) { // y is int
        this.x = x;
        this.y = y;
        this.r = r;
    }

    public boolean checkData() {
        return checkX() && checkY() && checkR();
    }

    private boolean checkX() {
        return Double.isFinite(x) && (x >= X_MIN && x <= X_MAX);
    }

    private boolean checkY() {
        for (int validY : VALID_Y_VALUES) { // اعتبارسنجی مستقیم بدون نیاز به تلورانس
            if (y == validY) {
                return true;
            }
        }
        return false;
    }

    private boolean checkR() {
        return Double.isFinite(r) && (r > R_MIN && r < R_MAX);    }
}
