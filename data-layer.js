/**
 * Todo List Data Layer - Complete Persistence System
 *
 * This file implements the complete data persistence and state management
 * system for the todo list application using localStorage.
 *
 * Components:
 * - Task Model: Core data structure with validation
 * - AppState Management: Centralized state with statistics and filtering
 * - StorageService: localStorage operations with error handling
 * - ValidationService: Data validation and sanitization
 */

/**
 * Task Model - Core data structure for todo items
 *
 * @typedef {Object} Task
 * @property {string} id - Unique identifier (UUID v4)
 * @property {string} text - Task description text
 * @property {boolean} completed - Completion status
 * @property {string} createdAt - ISO 8601 timestamp for creation
 * @property {string} updatedAt - ISO 8601 timestamp for last update
 * @property {number} order - Display order index
 * @property {string} [priority] - Optional priority level (low, medium, high)
 * @property {string} [category] - Optional category classification
 */
class Task {
    /**
     * Create a new Task instance
     * @param {Object} data - Task data
     * @param {string} data.text - Task description
     * @param {boolean} [data.completed=false] - Completion status
     * @param {string} [data.priority] - Priority level
     * @param {string} [data.category] - Category
     */
    constructor({ text, completed = false, priority, category }) {
        this.id = this.generateId();
        this.text = text;
        this.completed = completed;
        this.priority = priority || 'medium';
        this.category = category || 'general';
        this.createdAt = new Date().toISOString();
        this.updatedAt = new Date().toISOString();
        this.order = 0;
    }

    /**
     * Generate unique identifier
     * @returns {string} UUID v4 format
     */
    generateId() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Update task properties
     * @param {Object} updates - Properties to update
     */
    update(updates) {
        const allowedUpdates = ['text', 'completed', 'priority', 'category', 'order'];
        const updateKeys = Object.keys(updates);

        for (const key of updateKeys) {
            if (allowedUpdates.includes(key)) {
                this[key] = updates[key];
            }
        }

        this.updatedAt = new Date().toISOString();
    }

    /**
     * Validate task data
     * @returns {boolean} True if valid
     */
    validate() {
        return (
            typeof this.id === 'string' &&
            this.id.length > 0 &&
            typeof this.text === 'string' &&
            this.text.trim().length > 0 &&
            typeof this.completed === 'boolean' &&
            this.createdAt &&
            this.updatedAt &&
            typeof this.order === 'number'
        );
    }

    /**
     * Convert task to plain object
     * @returns {Object} Plain object representation
     */
    toJSON() {
        return {
            id: this.id,
            text: this.text,
            completed: this.completed,
            priority: this.priority,
            category: this.category,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            order: this.order
        };
    }

    /**
     * Create task from plain object
     * @param {Object} data - Plain object data
     * @returns {Task} Task instance
     */
    static fromJSON(data) {
        const task = new Task({ text: data.text });
        Object.assign(task, data);
        return task;
    }
}

/**
 * Application State Model
 *
 * @typedef {Object} AppState
 * @property {Task[]} tasks - Array of task objects
 * @property {number} nextOrderId - Next available order index
 * @property {string} lastSync - Last sync timestamp
 * @property {Object} stats - Computed statistics
 * @property {Object} filters - Current active filters
 */
class AppState {
    constructor() {
        this.tasks = [];
        this.nextOrderId = 0;
        this.lastSync = null;
        this.stats = {
            total: 0,
            completed: 0,
            pending: 0,
            completionRate: 0
        };
        this.filters = {
            category: 'all',
            priority: 'all',
            status: 'all',
            search: ''
        };
    }

    /**
     * Update state with new tasks
     * @param {Task[]} tasks - Array of tasks
     */
    setTasks(tasks) {
        this.tasks = tasks.map(task => Task.fromJSON(task));
        this.updateStats();
    }

    /**
     * Add new task to state
     * @param {Task} task - Task to add
     */
    addTask(task) {
        task.order = this.nextOrderId++;
        this.tasks.push(task);
        this.updateStats();
    }

    /**
     * Update task in state
     * @param {string} taskId - Task ID to update
     * @param {Object} updates - Properties to update
     * @returns {boolean} True if task was updated
     */
    updateTask(taskId, updates) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            task.update(updates);
            this.updateStats();
            return true;
        }
        return false;
    }

    /**
     * Remove task from state
     * @param {string} taskId - Task ID to remove
     * @returns {boolean} True if task was removed
     */
    removeTask(taskId) {
        const index = this.tasks.findIndex(t => t.id === taskId);
        if (index !== -1) {
            this.tasks.splice(index, 1);
            this.reorderTasks();
            this.updateStats();
            return true;
        }
        return false;
    }

    /**
     * Reorder tasks after deletion
     */
    reorderTasks() {
        this.tasks.forEach((task, index) => {
            task.order = index;
        });
        this.nextOrderId = this.tasks.length;
    }

    /**
     * Update computed statistics
     */
    updateStats() {
        this.stats.total = this.tasks.length;
        this.stats.completed = this.tasks.filter(t => t.completed).length;
        this.stats.pending = this.stats.total - this.stats.completed;
        this.stats.completionRate = this.stats.total > 0
            ? Math.round((this.stats.completed / this.stats.total) * 100)
            : 0;
    }

    /**
     * Get filtered tasks based on current filters
     * @returns {Task[]} Filtered tasks
     */
    getFilteredTasks() {
        return this.tasks.filter(task => {
            // Category filter
            if (this.filters.category !== 'all' && task.category !== this.filters.category) {
                return false;
            }

            // Priority filter
            if (this.filters.priority !== 'all' && task.priority !== this.filters.priority) {
                return false;
            }

            // Status filter
            if (this.filters.status !== 'all') {
                if (this.filters.status === 'completed' && !task.completed) return false;
                if (this.filters.status === 'pending' && task.completed) return false;
            }

            // Search filter
            if (this.filters.search) {
                const searchTerm = this.filters.search.toLowerCase();
                return task.text.toLowerCase().includes(searchTerm);
            }

            return true;
        });
    }

    /**
     * Set filter values
     * @param {Object} filters - Filter values to set
     */
    setFilters(filters) {
        this.filters = { ...this.filters, ...filters };
    }

    /**
     * Export state for serialization
     * @returns {Object} Serializable state
     */
    toJSON() {
        return {
            tasks: this.tasks.map(task => task.toJSON()),
            nextOrderId: this.nextOrderId,
            lastSync: this.lastSync,
            filters: this.filters
        };
    }

    /**
     * Import state from data
     * @param {Object} data - State data
     * @returns {boolean} True if import successful
     */
    fromJSON(data) {
        try {
            if (data.tasks) {
                this.tasks = data.tasks.map(taskData => Task.fromJSON(taskData));
            }
            this.nextOrderId = data.nextOrderId || 0;
            this.lastSync = data.lastSync || null;
            this.filters = data.filters || this.filters;
            this.updateStats();
            return true;
        } catch (error) {
            console.error('Failed to import state:', error);
            return false;
        }
    }
}

/**
 * LocalStorage Service - Handle data persistence
 *
 * @class StorageService
 */
class StorageService {
    constructor() {
        this.storageKey = 'todoListApp_v1';
        this.maxStorageSize = 5 * 1024 * 1024; // 5MB limit
        this.dataVersion = '1.0.0';
    }

    /**
     * Check if localStorage is available
     * @returns {boolean} True if localStorage is available
     */
    isStorageAvailable() {
        try {
            const testKey = '__localStorage_test__';
            localStorage.setItem(testKey, 'test');
            localStorage.removeItem(testKey);
            return true;
        } catch (error) {
            console.warn('localStorage not available:', error);
            return false;
        }
    }

    /**
     * Get current storage usage
     * @returns {Object} Storage usage information
     */
    getStorageInfo() {
        if (!this.isStorageAvailable()) {
            return { available: false, used: 0, total: 0, percentage: 0 };
        }

        try {
            const data = localStorage.getItem(this.storageKey);
            const used = data ? new Blob([data]).size : 0;
            const total = this.maxStorageSize;
            const percentage = total > 0 ? (used / total) * 100 : 0;

            return {
                available: true,
                used,
                total,
                percentage: Math.round(percentage)
            };
        } catch (error) {
            console.error('Error getting storage info:', error);
            return { available: false, used: 0, total: 0, percentage: 0 };
        }
    }

    /**
     * Save state to localStorage
     * @param {AppState} state - Application state to save
     * @returns {Promise<boolean>} True if save successful
     */
    async saveState(state) {
        if (!this.isStorageAvailable()) {
            console.warn('Cannot save state: localStorage not available');
            return false;
        }

        try {
            const data = {
                version: this.dataVersion,
                timestamp: new Date().toISOString(),
                state: state.toJSON(),
                checksum: await this.generateChecksum(state.toJSON())
            };

            const serialized = JSON.stringify(data);
            const size = new Blob([serialized]).size;

            // Check storage limits
            if (size > this.maxStorageSize) {
                throw new Error(`Storage limit exceeded: ${size} > ${this.maxStorageSize} bytes`);
            }

            localStorage.setItem(this.storageKey, serialized);
            state.lastSync = new Date().toISOString();

            console.log(`State saved successfully (${this.formatBytes(size)})`);
            return true;
        } catch (error) {
            console.error('Failed to save state:', error);
            this.handleStorageError(error);
            return false;
        }
    }

    /**
     * Load state from localStorage
     * @returns {Promise<AppState>} Loaded state or default state
     */
    async loadState() {
        if (!this.isStorageAvailable()) {
            console.warn('Cannot load state: localStorage not available');
            return new AppState();
        }

        try {
            const serialized = localStorage.getItem(this.storageKey);

            if (!serialized) {
                console.log('No saved state found, returning default');
                return new AppState();
            }

            const data = JSON.parse(serialized);

            // Validate data structure
            if (!this.validateStoredData(data)) {
                throw new Error('Invalid stored data structure');
            }

            // Verify checksum
            const storedChecksum = data.checksum;
            const calculatedChecksum = await this.generateChecksum(data.state);

            if (storedChecksum !== calculatedChecksum) {
                console.warn('Data checksum mismatch, data may be corrupted');
                // Still try to load, but warn about potential corruption
            }

            const state = new AppState();
            const success = state.fromJSON(data.state);

            if (success) {
                console.log(`State loaded successfully (${this.formatBytes(new Blob([serialized]).size)})`);
                return state;
            } else {
                throw new Error('Failed to import state data');
            }
        } catch (error) {
            console.error('Failed to load state:', error);
            this.handleStorageError(error);
            return new AppState();
        }
    }

    /**
     * Clear all stored data
     * @returns {boolean} True if clear successful
     */
    clearStorage() {
        if (!this.isStorageAvailable()) {
            return false;
        }

        try {
            localStorage.removeItem(this.storageKey);
            console.log('Storage cleared successfully');
            return true;
        } catch (error) {
            console.error('Failed to clear storage:', error);
            return false;
        }
    }

    /**
     * Export data for backup
     * @returns {Promise<string>} JSON data string
     */
    async exportData() {
        if (!this.isStorageAvailable()) {
            throw new Error('Storage not available for export');
        }

        const data = localStorage.getItem(this.storageKey);
        if (!data) {
            throw new Error('No data to export');
        }

        return data;
    }

    /**
     * Import data from backup
     * @param {string} jsonData - JSON data to import
     * @returns {Promise<boolean>} True if import successful
     */
    async importData(jsonData) {
        if (!this.isStorageAvailable()) {
            throw new Error('Storage not available for import');
        }

        try {
            const data = JSON.parse(jsonData);

            if (!this.validateStoredData(data)) {
                throw new Error('Invalid import data structure');
            }

            localStorage.setItem(this.storageKey, JSON.stringify(data));
            console.log('Data imported successfully');
            return true;
        } catch (error) {
            console.error('Failed to import data:', error);
            throw error;
        }
    }

    /**
     * Generate checksum for data integrity
     * @param {Object} data - Data to checksum
     * @returns {Promise<string>} Checksum string
     */
    async generateChecksum(data) {
        const serialized = JSON.stringify(data);
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(serialized);
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Validate stored data structure
     * @param {Object} data - Data to validate
     * @returns {boolean} True if valid
     */
    validateStoredData(data) {
        return (
            data &&
            typeof data === 'object' &&
            data.version &&
            data.timestamp &&
            data.state &&
            Array.isArray(data.state.tasks)
        );
    }

    /**
     * Handle storage errors gracefully
     * @param {Error} error - Storage error
     */
    handleStorageError(error) {
        console.error('Storage error:', error);

        // Dispatch custom event for UI feedback
        window.dispatchEvent(new CustomEvent('storageError', {
            detail: { error: error.message }
        }));

        // Implement recovery strategies
        if (error.name === 'QuotaExceededError') {
            // Try to recover by clearing old data or notifying user
            window.dispatchEvent(new CustomEvent('storageQuotaExceeded'));
        }
    }

    /**
     * Format bytes for display
     * @param {number} bytes - Bytes to format
     * @returns {string} Formatted string
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

/**
 * Data Validation Service
 *
 * @class ValidationService
 */
class ValidationService {
    constructor() {
        this.rules = {
            task: {
                text: {
                    required: true,
                    minLength: 1,
                    maxLength: 255,
                    pattern: /^[a-zA-Z0-9\s\-_.,!?@#$%^&*()+=\[\]{}|\\:;"'<>\~`]+$/
                },
                priority: {
                    required: false,
                    enum: ['low', 'medium', 'high']
                },
                category: {
                    required: false,
                    minLength: 1,
                    maxLength: 50
                }
            }
        };
    }

    /**
     * Validate task data
     * @param {Object} taskData - Task data to validate
     * @returns {Object} Validation result
     */
    validateTask(taskData) {
        const errors = [];
        const warnings = [];

        // Text validation
        if (!taskData.text || typeof taskData.text !== 'string') {
            errors.push('Task text is required and must be a string');
        } else {
            const text = taskData.text.trim();

            if (text.length === 0) {
                errors.push('Task text cannot be empty');
            } else if (text.length > 255) {
                errors.push('Task text cannot exceed 255 characters');
            } else if (!this.rules.task.text.pattern.test(text)) {
                warnings.push('Task text contains unusual characters');
            }
        }

        // Priority validation
        if (taskData.priority && !this.rules.task.priority.enum.includes(taskData.priority)) {
            errors.push('Priority must be one of: low, medium, high');
        }

        // Category validation
        if (taskData.category) {
            if (typeof taskData.category !== 'string') {
                errors.push('Category must be a string');
            } else if (taskData.category.length > 50) {
                errors.push('Category cannot exceed 50 characters');
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Validate task update data
     * @param {Object} updates - Update data to validate
     * @returns {Object} Validation result
     */
    validateTaskUpdate(updates) {
        const validFields = ['text', 'completed', 'priority', 'category', 'order'];
        const errors = [];
        const warnings = [];

        // Check for invalid fields
        const updateFields = Object.keys(updates);
        const invalidFields = updateFields.filter(field => !validFields.includes(field));

        if (invalidFields.length > 0) {
            errors.push(`Invalid update fields: ${invalidFields.join(', ')}`);
        }

        // Validate specific fields if present
        if (updates.text !== undefined) {
            const textValidation = this.validateTask({ text: updates.text });
            errors.push(...textValidation.errors);
            warnings.push(...textValidation.warnings);
        }

        if (updates.completed !== undefined && typeof updates.completed !== 'boolean') {
            errors.push('Completed must be a boolean value');
        }

        if (updates.priority !== undefined) {
            const priorityValidation = this.validateTask({ priority: updates.priority });
            errors.push(...priorityValidation.errors);
        }

        if (updates.order !== undefined && typeof updates.order !== 'number') {
            errors.push('Order must be a number');
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Sanitize task data
     * @param {Object} taskData - Task data to sanitize
     * @returns {Object} Sanitized data
     */
    sanitizeTask(taskData) {
        const sanitized = {};

        if (taskData.text) {
            sanitized.text = this.sanitizeText(taskData.text);
        }

        if (taskData.priority) {
            sanitized.priority = this.sanitizePriority(taskData.priority);
        }

        if (taskData.category) {
            sanitized.category = this.sanitizeCategory(taskData.category);
        }

        return sanitized;
    }

    /**
     * Sanitize text input
     * @param {string} text - Text to sanitize
     * @returns {string} Sanitized text
     */
    sanitizeText(text) {
        return text
            .trim()
            .replace(/\s+/g, ' ') // Multiple spaces to single space
            .replace(/[<>]/g, '') // Remove potential HTML tags
            .substring(0, 255); // Truncate to max length
    }

    /**
     * Sanitize priority value
     * @param {string} priority - Priority to sanitize
     * @returns {string} Sanitized priority or default
     */
    sanitizePriority(priority) {
        const validPriorities = ['low', 'medium', 'high'];
        return validPriorities.includes(priority) ? priority : 'medium';
    }

    /**
     * Sanitize category value
     * @param {string} category - Category to sanitize
     * @returns {string} Sanitized category
     */
    sanitizeCategory(category) {
        return typeof category === 'string'
            ? category.trim().substring(0, 50)
            : 'general';
    }
}

// Export classes for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        Task,
        AppState,
        StorageService,
        ValidationService
    };
} else if (typeof window !== 'undefined') {
    // Browser environment
    window.TodoListDataLayer = {
        Task,
        AppState,
        StorageService,
        ValidationService
    };
}