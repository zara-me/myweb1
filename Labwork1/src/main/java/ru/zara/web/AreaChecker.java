package ru.zara.web;

public class AreaChecker {
        //  y is int
    public static boolean isInArea(double x, int y, double r) {

        //  r < 2
        if (!Double.isFinite(x) || r < 2 || !Double.isFinite(r)) {
            return false;
        }

        final double eps = 1e-9;

        // Rectangle: Q1
        // 0 <= x <= R  AND  0 <= y <= R/2
        if (x >= -eps && x <= r + eps && y >= -eps && y <= (r / 2.0) + eps) {
            if (x >= -eps && y >= -eps) return true;
        }

        // Triangle: Q4
        // 0 <= x <= R AND -R <= y <= 0 AND y >= x - R
        if (x >= -eps && x <= r + eps && y <= eps && y >= -r - eps) {
            double boundary = x - r; // y >= x - R
            if (y + eps >= boundary) {
                // x>=0 و y<=0
                if (x >= -eps && y <= eps) return true;
            }
        }

        // Quarter circle: Q3
        // x <= 0, y <= 0, and x^2 + y^2 <= R^2
        if (x <= eps && y <= eps) {
            double lhs = x * x + (double)y * y; // y به double cast شد
            double rhs = r * r;
            if (lhs <= rhs + eps) {
                return true;
            }
        }

        return false;
    }
}
