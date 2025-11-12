export default class InputValidator {
    constructor() {
        this.message = '';

        this.X_MIN_EXCLUSIVE = -3;
        this.X_MAX_EXCLUSIVE = 5;
        this.R_MIN_EXCLUSIVE = 2;
        this.R_MAX_EXCLUSIVE = 5;
    }

    sanitizeInput(value) {
        if (!value) return '';
        let sanitized = String(value).replace(/[^\d.\-]/g, '');

        sanitized = sanitized.replace(/(\..*)\./g, '$1');

        // مدیریت علامت منفی: فقط یک علامت در ابتدای رشته مجاز است
        const parts = sanitized.split('-');
        if (parts.length > 1) {
            sanitized = '-' + parts.join('');
            sanitized = sanitized.replace('--', '-');
            if (sanitized.indexOf('-') !== 0) {
                sanitized = sanitized.replace(/-/g, '');
            }
        }
        return sanitized;
    }

    validateXInput(xStr) {
        this.message = '';
        const trimmed = xStr.trim();
        if (trimmed === '') {
            this.message = 'Поле X не может быть пустым.';
            return false;
        }

        const x = parseFloat(trimmed);
        if (isNaN(x)) {
            this.message = 'Значение X должно быть числом.';
            return false;
        }

        if (x <= this.X_MIN_EXCLUSIVE || x >= this.X_MAX_EXCLUSIVE) {
            this.message = `Значение X должно быть в диапазоне (${this.X_MIN_EXCLUSIVE}, ${this.X_MAX_EXCLUSIVE}).`;
            return false;
        }
        return true;
    }

    validateRInput(rStr) {
        this.message = '';
        const trimmed = rStr.trim();
        if (trimmed === '') {
            this.message = 'Поле R не может быть пустым.';
            return false;
        }

        const r = parseFloat(trimmed);
        if (isNaN(r)) {
            this.message = 'Значение R должно быть числом.';
            return false;
        }

        if (r <= this.R_MIN_EXCLUSIVE || r >= this.R_MAX_EXCLUSIVE) {
            this.message = `Значение R должно быть в диапазоне (${this.R_MIN_EXCLUSIVE}, ${this.R_MAX_EXCLUSIVE}).`;
            return false;
        }
        return true;
    }

    getMessage() {
        return this.message;
    }
}
