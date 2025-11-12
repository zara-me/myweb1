package ru.zara.web;

public class AreaChecker {

    public static boolean isInArea(double x, double y, double r) {

        if (!Double.isFinite(x) || !Double.isFinite(y) || !Double.isFinite(r) || r <= 0) {
            return false;
        }

        // کمی تلورانس برای محاسبات ممیز شناور
        final double eps = 1e-9;

        // Rectangle: Q1
        // 0 <= x <= R  AND  0 <= y <= R/2
        if (x >= -eps && x <= r + eps && y >= -eps && y <= (r / 2.0) + eps) {
            if (x >= -eps && y >= -eps) return true;
        }

        if (x >= -eps && x <= r + eps && y <= eps && y >= -r - eps) {
            double boundary = x - r; // y >= x - R
            if (y + eps >= boundary) {
                return true;
            }
        }

        // Quarter circle: Q3
        // x <= 0, y <= 0, and x^2 + y^2 <= R^2
        if (x <= eps && y <= eps) {
            double lhs = x * x + y * y;
            double rhs = r * r;
            if (lhs <= rhs + eps) {
                return true;
            }
        }

        return false;
    }
}