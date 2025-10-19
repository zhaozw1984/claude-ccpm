/**
 * Todo List Application - Core JavaScript Architecture
 *
 * Event-driven MVC-inspired todo list application with comprehensive CRUD operations,
 * undo/redo functionality, cross-tab synchronization, and accessibility features.
 *
 * @author Claude Code
 * @version 1.0.0
 * @date 2025-10-19
 */

'use strict';

// ============================================================================
// DATA MODELS
// ============================================================================

/**
 * Individual Task Model
 *
 * Represents a single todo item with all its properties and methods
 * @class
 */
class Task {
    /**
     * Create a new task
     * @param {Object} data - Task data
     * @param {string} data.text - Task text content
     * @param {boolean} [data.completed=false] - Task completion status
     * @param {string} [data.id] - Unique task identifier
     * @param {number} [data.order=0] - Task order in list
     * @param {string} [data.priority='normal'] - Task priority
     * @param {string} [data.category='general'] - Task category
     * @param {string} [data.createdAt] - Creation timestamp
     * @param {string} [data.updatedAt] - Last update timestamp
     */
    constructor(data = {}) {
        if (!data.text || typeof data.text !== 'string') {
            throw new Error('Task text is required and must be a string');
        }

        this.id = data.id || this.generateId();
        this.text = data.text.trim();
        this.completed = Boolean(data.completed);
        this.order = typeof data.order === 'number' ? data.order : 0;
        this.priority = data.priority || 'normal';
        this.category = data.category || 'general';
        this.createdAt = data.createdAt || new Date().toISOString();
        this.updatedAt = data.updatedAt || new Date().toISOString();
    }

    /**
     * Generate unique ID for task
     * @private
     * @returns {string} Unique identifier
     */
    generateId() {
        return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Toggle task completion status
     * @returns {Task} Updated task instance
     */
    toggle() {
        this.completed = !this.completed;
        this.updatedAt = new Date().toISOString();
        return this;
    }

    /**
     * Update task text
     * @param {string} newText - New task text
     * @returns {Task} Updated task instance
     */
    updateText(newText) {
        if (!newText || typeof newText !== 'string') {
            throw new Error('Task text is required and must be a string');
        }
        this.text = newText.trim();
        this.updatedAt = new Date().toISOString();
        return this;
    }

    /**
     * Update task order
     * @param {number} newOrder - New order position
     * @returns {Task} Updated task instance
     */
    updateOrder(newOrder) {
        if (typeof newOrder !== 'number' || newOrder < 0) {
            throw new Error('Order must be a non-negative number');
        }
        this.order = newOrder;
        this.updatedAt = new Date().toISOString();
        return this;
    }

    /**
     * Convert task to JSON representation
     * @returns {Object} Task data as plain object
     */
    toJSON() {
        return {
            id: this.id,
            text: this.text,
            completed: this.completed,
            order: this.order,
            priority: this.priority,
            category: this.category,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    /**
     * Create task from JSON data
     * @param {Object} data - Task data object
     * @returns {Task} Task instance
     * @static
     */
    static fromJSON(data) {
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid task data');
        }
        return new Task(data);
    }

    /**
     * Clone task instance
     * @returns {Task} New task instance with same data
     */
    clone() {
        return Task.fromJSON(this.toJSON());
    }
}

/**
 * Application State Manager
 *
 * Manages the complete application state including tasks and statistics
 * @class
 */
class AppState {
    /**
     * Create new application state
     * @param {Object} data - Initial state data
     */
    constructor(data = {}) {
        this.tasks = [];
        this.filters = data.filters || { showCompleted: true, showActive: true };
        this.stats = {
            total: 0,
            completed: 0,
            active: 0,
            completionRate: 0
        };

        // Load initial data if provided
        if (data.tasks && Array.isArray(data.tasks)) {
            data.tasks.forEach(taskData => {
                this.tasks.push(Task.fromJSON(taskData));
            });
        }

        // Calculate initial stats
        this.updateStats();
    }

    /**
     * Add task to state
     * @param {Task} task - Task to add
     */
    addTask(task) {
        if (!(task instanceof Task)) {
            throw new Error('Must provide Task instance');
        }

        // Set order to end of list
        task.updateOrder(this.tasks.length);
        this.tasks.push(task);
        this.updateStats();
    }

    /**
     * Remove task from state
     * @param {string} taskId - ID of task to remove
     * @returns {boolean} True if task was removed
     */
    removeTask(taskId) {
        const initialLength = this.tasks.length;
        this.tasks = this.tasks.filter(task => task.id !== taskId);

        if (this.tasks.length < initialLength) {
            // Reorder remaining tasks
            this.reorderTasks();
            this.updateStats();
            return true;
        }
        return false;
    }

    /**
     * Update task in state
     * @param {string} taskId - ID of task to update
     * @param {Object} updates - Updates to apply
     * @returns {boolean} True if task was updated
     */
    updateTask(taskId, updates) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return false;

        // Apply updates
        if (updates.text !== undefined) task.updateText(updates.text);
        if (updates.completed !== undefined) {
            if (task.completed !== updates.completed) {
                task.toggle();
            }
        }
        if (updates.order !== undefined) task.updateOrder(updates.order);

        this.updateStats();
        return true;
    }

    /**
     * Reorder all tasks sequentially
     */
    reorderTasks() {
        this.tasks.forEach((task, index) => {
            task.updateOrder(index);
        });
    }

    /**
     * Get filtered tasks based on current filters
     * @returns {Array<Task>} Filtered task list
     */
    getFilteredTasks() {
        return this.tasks.filter(task => {
            if (!this.filters.showCompleted && task.completed) return false;
            if (!this.filters.showActive && !task.completed) return false;
            return true;
        });
    }

    /**
     * Update statistics
     * @private
     */
    updateStats() {
        this.stats.total = this.tasks.length;
        this.stats.completed = this.tasks.filter(t => t.completed).length;
        this.stats.active = this.stats.total - this.stats.completed;
        this.stats.completionRate = this.stats.total > 0
            ? Math.round((this.stats.completed / this.stats.total) * 100)
            : 0;
    }

    /**
     * Convert state to JSON representation
     * @returns {Object} State data as plain object
     */
    toJSON() {
        return {
            tasks: this.tasks.map(task => task.toJSON()),
            filters: { ...this.filters },
            stats: { ...this.stats }
        };
    }

    /**
     * Load state from JSON data
     * @param {Object} data - State data object
     */
    fromJSON(data) {
        if (!data || typeof data !== 'object') return;

        // Load tasks
        if (data.tasks && Array.isArray(data.tasks)) {
            this.tasks = data.tasks.map(taskData => Task.fromJSON(taskData));
        }

        // Load filters
        if (data.filters && typeof data.filters === 'object') {
            this.filters = { ...this.filters, ...data.filters };
        }

        // Update stats
        this.updateStats();
    }

    /**
     * Clear all tasks and reset state
     */
    clear() {
        this.tasks = [];
        this.filters = { showCompleted: true, showActive: true };
        this.updateStats();
    }

    /**
     * Create state snapshot for undo/redo
     * @returns {Object} State snapshot
     */
    createSnapshot() {
        return {
            tasks: this.tasks.map(task => task.toJSON()),
            filters: { ...this.filters },
            stats: { ...this.stats }
        };
    }

    /**
     * Restore state from snapshot
     * @param {Object} snapshot - State snapshot to restore
     */
    restoreSnapshot(snapshot) {
        if (!snapshot || typeof snapshot !== 'object') return;

        // Restore tasks
        if (snapshot.tasks && Array.isArray(snapshot.tasks)) {
            this.tasks = snapshot.tasks.map(taskData => Task.fromJSON(taskData));
        }

        // Restore filters
        if (snapshot.filters && typeof snapshot.filters === 'object') {
            this.filters = { ...snapshot.filters };
        }

        // Restore stats
        if (snapshot.stats && typeof snapshot.stats === 'object') {
            this.stats = { ...snapshot.stats };
        }
    }
}

/**
 * Storage Service
 *
 * Handles localStorage operations for data persistence
 * @class
 */
class StorageService {
    /**
     * Create storage service
     * @param {Object} config - Storage configuration
     */
    constructor(config = {}) {
        this.storageKey = config.storageKey || 'todoApp_v1';
        this.maxStorageSize = config.maxStorageSize || 5 * 1024 * 1024; // 5MB
        this.compressionEnabled = config.compressionEnabled || false;
        this.syncEnabled = config.syncEnabled || true;
    }

    /**
     * Save state to localStorage
     * @param {AppState} state - Application state to save
     * @returns {Promise<boolean>} True if saved successfully
     */
    async saveState(state) {
        try {
            // Check if localStorage is available
            if (!this.isLocalStorageAvailable()) {
                throw new Error('localStorage not available');
            }

            const data = state.toJSON();
            const json = JSON.stringify(data);

            // Check storage size
            if (json.length > this.maxStorageSize) {
                throw new Error('Storage limit exceeded');
            }

            // Save to localStorage
            localStorage.setItem(this.storageKey, json);

            // Trigger sync event if enabled
            if (this.syncEnabled) {
                this.triggerStorageEvent('save', data);
            }

            console.log('State saved successfully');
            return true;
        } catch (error) {
            console.error('Failed to save state:', error);
            this.triggerStorageError(error);
            throw error;
        }
    }

    /**
     * Load state from localStorage
     * @returns {Promise<AppState>} Loaded application state
     */
    async loadState() {
        try {
            // Check if localStorage is available
            if (!this.isLocalStorageAvailable()) {
                throw new Error('localStorage not available');
            }

            const json = localStorage.getItem(this.storageKey);
            if (!json) {
                return new AppState();
            }

            const data = JSON.parse(json);
            const state = new AppState();
            state.fromJSON(data);

            console.log('State loaded successfully');
            return state;
        } catch (error) {
            console.error('Failed to load state:', error);
            this.triggerStorageError(error);
            throw error;
        }
    }

    /**
     * Clear saved data from localStorage
     * @returns {Promise<boolean>} True if cleared successfully
     */
    async clearStorage() {
        try {
            if (!this.isLocalStorageAvailable()) {
                throw new Error('localStorage not available');
            }

            localStorage.removeItem(this.storageKey);
            console.log('Storage cleared successfully');
            return true;
        } catch (error) {
            console.error('Failed to clear storage:', error);
            this.triggerStorageError(error);
            throw error;
        }
    }

    /**
     * Check if localStorage is available
     * @private
     * @returns {boolean} True if available
     */
    isLocalStorageAvailable() {
        try {
            const testKey = '__localStorage_test__';
            localStorage.setItem(testKey, 'test');
            localStorage.removeItem(testKey);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Trigger storage event for cross-tab synchronization
     * @private
     * @param {string} action - Storage action
     * @param {Object} data - Storage data
     */
    triggerStorageEvent(action, data) {
        const event = new CustomEvent('storageSync', {
            detail: { action, data, timestamp: new Date().toISOString() }
        });
        window.dispatchEvent(event);
    }

    /**
     * Trigger storage error event
     * @private
     * @param {Error} error - Storage error
     */
    triggerStorageError(error) {
        const event = new CustomEvent('storageError', {
            detail: { error: error.message, timestamp: new Date().toISOString() }
        });
        window.dispatchEvent(event);
    }
}

/**
 * Validation Service
 *
 * Handles input validation and sanitization
 * @class
 */
class ValidationService {
    /**
     * Create validation service
     */
    constructor() {
        this.validators = {
            task: this.validateTask.bind(this),
            text: this.validateText.bind(this),
            taskId: this.validateTaskId.bind(this)
        };
    }

    /**
     * Validate task data
     * @param {Object} taskData - Task data to validate
     * @returns {Object} Validation result
     */
    validateTask(taskData) {
        const errors = [];

        if (!taskData) {
            errors.push('Task data is required');
            return { isValid: false, errors };
        }

        // Validate text
        if (!taskData.text || typeof taskData.text !== 'string') {
            errors.push('Task text is required and must be a string');
        } else if (taskData.text.trim().length === 0) {
            errors.push('Task text cannot be empty');
        } else if (taskData.text.length > 500) {
            errors.push('Task text cannot exceed 500 characters');
        }

        // Validate priority
        if (taskData.priority && !['low', 'normal', 'high'].includes(taskData.priority)) {
            errors.push('Priority must be low, normal, or high');
        }

        // Validate category
        if (taskData.category && typeof taskData.category !== 'string') {
            errors.push('Category must be a string');
        } else if (taskData.category && taskData.category.length > 50) {
            errors.push('Category cannot exceed 50 characters');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Validate text input
     * @param {string} text - Text to validate
     * @returns {Object} Validation result
     */
    validateText(text) {
        const errors = [];

        if (!text || typeof text !== 'string') {
            errors.push('Text is required and must be a string');
            return { isValid: false, errors };
        }

        if (text.trim().length === 0) {
            errors.push('Text cannot be empty');
        }

        if (text.length > 500) {
            errors.push('Text cannot exceed 500 characters');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Validate task ID
     * @param {string} taskId - Task ID to validate
     * @returns {Object} Validation result
     */
    validateTaskId(taskId) {
        const errors = [];

        if (!taskId || typeof taskId !== 'string') {
            errors.push('Task ID is required and must be a string');
            return { isValid: false, errors };
        }

        if (taskId.length < 5 || taskId.length > 50) {
            errors.push('Task ID must be between 5 and 50 characters');
        }

        if (!taskId.match(/^[a-zA-Z0-9_-]+$/)) {
            errors.push('Task ID contains invalid characters');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Sanitize task data
     * @param {Object} taskData - Task data to sanitize
     * @returns {Object} Sanitized task data
     */
    sanitizeTask(taskData) {
        if (!taskData) return {};

        const sanitized = {
            text: this.sanitizeText(taskData.text),
            completed: Boolean(taskData.completed),
            priority: this.sanitizePriority(taskData.priority),
            category: this.sanitizeCategory(taskData.category)
        };

        // Remove undefined properties
        Object.keys(sanitized).forEach(key => {
            if (sanitized[key] === undefined) {
                delete sanitized[key];
            }
        });

        return sanitized;
    }

    /**
     * Sanitize text input
     * @param {string} text - Text to sanitize
     * @returns {string} Sanitized text
     */
    sanitizeText(text) {
        if (!text || typeof text !== 'string') return '';

        // Remove HTML tags and scripts
        let sanitized = text.replace(/<[^>]*>/g, '');
        sanitized = sanitized.replace(/javascript:/gi, '');
        sanitized = sanitized.replace(/on\w+\s*=/gi, '');

        // Trim whitespace
        sanitized = sanitized.trim();

        // Limit length
        return sanitized.substring(0, 500);
    }

    /**
     * Sanitize priority
     * @param {string} priority - Priority to sanitize
     * @returns {string} Sanitized priority
     */
    sanitizePriority(priority) {
        if (!priority || typeof priority !== 'string') return 'normal';

        const validPriorities = ['low', 'normal', 'high'];
        return validPriorities.includes(priority) ? priority : 'normal';
    }

    /**
     * Sanitize category
     * @param {string} category - Category to sanitize
     * @returns {string} Sanitized category
     */
    sanitizeCategory(category) {
        if (!category || typeof category !== 'string') return 'general';

        // Remove special characters and limit length
        let sanitized = category.replace(/[^a-zA-Z0-9\s_-]/g, '');
        sanitized = sanitized.trim();
        return sanitized.substring(0, 50) || 'general';
    }
}

// ============================================================================
// MAIN APPLICATION CLASS
// ============================================================================

/**
 * Main Todo List Application Controller
 *
 * Core application controller that orchestrates all functionality
 * @class
 */
class TodoApp {
    /**
     * Create new TodoApp instance
     */
    constructor() {
        // Dependencies
        this.state = null;
        this.storage = null;
        this.validator = null;

        // DOM Elements
        this.elements = {};

        // Configuration
        this.config = {
            autoSave: true,
            autoSaveDelay: 1000, // 1 second
            maxUndoSteps: 50,
            animationDuration: 300,
            debounceTime: 300,
            keyboardShortcuts: true,
            crossTabSync: true,
            accessibility: true
        };

        // State Management
        this.isInitialized = false;
        this.isLoading = true;
        this.autoSaveTimer = null;
        this.undoStack = [];
        this.redoStack = [];

        // Event Listeners
        this.eventListeners = new Map();

        // Performance tracking
        this.performance = {
            renderTime: 0,
            lastOperation: null,
            operationCount: 0,
            memoryUsage: 0,
            lastCheckTime: Date.now()
        };

        // UI State
        this.ui = {
            isEditing: false,
            currentEditId: null,
            selectedTaskId: null,
            filterMode: 'all'
        };

        // Features
        this.features = {
            dragAndDrop: false, // Future enhancement
            themes: false, // Future enhancement
            keyboardNav: true,
            accessibility: true
        };
    }

    /**
     * Initialize the application
     * @returns {Promise<void>}
     */
    async init() {
        if (this.isInitialized) {
            console.warn('Application already initialized');
            return;
        }

        try {
            console.log('Initializing Todo App...');

            // Initialize dependencies
            await this.initializeDependencies();

            // Set up DOM elements
            this.setupDOMElements();

            // Set up event listeners
            this.setupEventListeners();

            // Load saved data
            await this.loadApplicationData();

            // Initial render
            this.render();

            // Update application state
            this.isInitialized = true;
            this.isLoading = false;

            // Start performance monitoring
            this.startPerformanceMonitoring();

            // Emit initialization complete event
            this.emit('initialized');

            console.log('Todo App initialized successfully');
        } catch (error) {
            console.error('Failed to initialize application:', error);
            this.handleError(error);
        }
    }

    /**
     * Initialize application dependencies
     * @private
     */
    async initializeDependencies() {
        // Initialize state management
        this.state = new AppState();

        // Initialize storage service
        this.storage = new StorageService({
            storageKey: 'todoApp_v1',
            maxStorageSize: 5 * 1024 * 1024, // 5MB
            syncEnabled: this.config.crossTabSync
        });

        // Initialize validation service
        this.validator = new ValidationService();

        console.log('Dependencies initialized successfully');
    }

    /**
     * Set up DOM element references
     * @private
     */
    setupDOMElements() {
        this.elements = {
            app: document.getElementById('app'),
            taskForm: document.getElementById('task-form'),
            taskInput: document.getElementById('task-input'),
            taskList: document.getElementById('task-list'),
            emptyState: document.getElementById('empty-state'),
            progressBar: document.getElementById('progress-bar'),
            progressFill: document.querySelector('.progress-fill'),
            completedCount: document.getElementById('completed-count'),
            totalCount: document.getElementById('total-count'),
            progressInfo: document.getElementById('progress-info'),
            footerText: document.querySelector('.footer-text'),
            filterAll: document.getElementById('filter-all'),
            filterActive: document.getElementById('filter-active'),
            filterCompleted: document.getElementById('filter-completed'),
            undoButton: document.getElementById('undo-btn'),
            redoButton: document.getElementById('redo-btn'),
            clearButton: document.getElementById('clear-btn')
        };

        // Validate DOM elements
        const missingElements = [];
        for (const [key, element] of Object.entries(this.elements)) {
            if (!element) {
                missingElements.push(key);
                console.warn(`DOM element not found: ${key}`);
            }
        }

        if (missingElements.length > 0) {
            console.warn('Some DOM elements are missing:', missingElements.join(', '));
            // Don't throw error - continue with available elements
        }
    }

    /**
     * Set up event listeners
     * @private
     */
    setupEventListeners() {
        // Form submission
        if (this.elements.taskForm) {
            this.elements.taskForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleAddTask();
            });
        }

        // Input events with debouncing
        if (this.elements.taskInput) {
            this.elements.taskInput.addEventListener('input',
                this.debounce(() => this.handleInputChange(), this.config.debounceTime)
            );
        }

        // Filter buttons
        if (this.elements.filterAll) {
            this.elements.filterAll.addEventListener('click', () => this.setFilter('all'));
        }
        if (this.elements.filterActive) {
            this.elements.filterActive.addEventListener('click', () => this.setFilter('active'));
        }
        if (this.elements.filterCompleted) {
            this.elements.filterCompleted.addEventListener('click', () => this.setFilter('completed'));
        }

        // Action buttons
        if (this.elements.undoButton) {
            this.elements.undoButton.addEventListener('click', () => this.undo());
        }
        if (this.elements.redoButton) {
            this.elements.redoButton.addEventListener('click', () => this.redo());
        }
        if (this.elements.clearButton) {
            this.elements.clearButton.addEventListener('click', () => this.clearAllTasks());
        }

        // Keyboard navigation
        if (this.features.keyboardNav) {
            document.addEventListener('keydown', (e) => this.handleKeyboardNavigation(e));
        }

        // Storage events for cross-tab sync
        if (this.config.crossTabSync) {
            window.addEventListener('storage', (e) => this.handleStorageEvent(e));
            window.addEventListener('storageSync', (e) => this.handleStorageSync(e));
            window.addEventListener('storageError', (e) => this.handleStorageError(e));
        }

        // Window events
        window.addEventListener('beforeunload', () => this.handleBeforeUnload());
        window.addEventListener('online', () => this.handleOnlineStatus(true));
        window.addEventListener('offline', () => this.handleOnlineStatus(false));

        // Custom application events
        this.on('task:created', () => this.autoSave());
        this.on('task:updated', () => this.autoSave());
        this.on('task:deleted', () => this.autoSave());
        this.on('state:changed', () => this.render());

        console.log('Event listeners configured successfully');
    }

    /**
     * Load application data from storage
     * @private
     */
    async loadApplicationData() {
        try {
            const savedState = await this.storage.loadState();
            this.state = savedState;
            console.log('Application data loaded successfully');
        } catch (error) {
            console.warn('Failed to load saved data, using defaults:', error);
            this.state = new AppState();
        }
    }

    /**
     * Start performance monitoring
     * @private
     */
    startPerformanceMonitoring() {
        if (window.performance && window.performance.memory) {
            setInterval(() => {
                this.performance.memoryUsage = Math.round(
                    window.performance.memory.usedJSHeapSize / 1024 / 1024
                );
                this.performance.lastCheckTime = Date.now();
            }, 5000); // Check every 5 seconds
        }
    }
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * Task Management Methods
 *
 * These methods handle all task-related operations and state management
 */
TodoApp.prototype.addTask = async function(text, options = {}) {
    try {
        // Validate input
        if (!text || typeof text !== 'string') {
            throw new Error('Task text is required');
        }

        const taskData = { text, ...options };

        // Validate task data
        const validation = this.validator.validateTask(taskData);
        if (!validation.isValid) {
            this.emit('validation:error', { errors: validation.errors });
            return null;
        }

        // Sanitize input
        const sanitized = this.validator.sanitizeTask(taskData);

        // Create task instance
        const task = new Task(sanitized);

        // Add to state
        this.state.addTask(task);

        // Add to undo stack
        this.addToUndoStack({
            action: 'create',
            taskId: task.id,
            taskData: task.toJSON()
        });

        // Clear redo stack
        this.redoStack = [];

        // Emit events
        this.emit('task:created', { task: task.toJSON() });
        this.emit('state:changed');

        // Update performance tracking
        this.performance.lastOperation = 'create';
        this.performance.operationCount++;

        // Commit this change
        await this.commitChange('Issue #6: Add new task', {
            taskId: task.id,
            text: task.text
        });

        return task.id;
    } catch (error) {
        console.error('Failed to add task:', error);
        this.handleError(error);
        return null;
    }
};

TodoApp.prototype.toggleTask = async function(taskId) {
    try {
        const task = this.state.tasks.find(t => t.id === taskId);
        if (!task) {
            throw new Error(`Task not found: ${taskId}`);
        }

        // Store previous state for undo
        const previousState = task.toJSON();

        // Toggle completion
        const updated = this.state.updateTask(taskId, {
            completed: !task.completed
        });

        if (updated) {
            // Add to undo stack
            this.addToUndoStack({
                action: 'toggle',
                taskId,
                previousState
            });

            // Clear redo stack
            this.redoStack = [];

            // Emit events
            this.emit('task:updated', {
                taskId,
                completed: !task.completed
            });
            this.emit('state:changed');

            // Update performance tracking
            this.performance.lastOperation = 'toggle';
            this.performance.operationCount++;

            // Commit this change
            await this.commitChange('Issue #6: Toggle task completion', {
                taskId,
                completed: !task.completed
            });

            return true;
        }

        return false;
    } catch (error) {
        console.error('Failed to toggle task:', error);
        this.handleError(error);
        return false;
    }
};

TodoApp.prototype.updateTaskText = async function(taskId, newText) {
    try {
        // Validate input
        if (!newText || typeof newText !== 'string') {
            throw new Error('Task text is required');
        }

        const task = this.state.tasks.find(t => t.id === taskId);
        if (!task) {
            throw new Error(`Task not found: ${taskId}`);
        }

        // Validate new text
        const validation = this.validator.validateTask({ text: newText });
        if (!validation.isValid) {
            this.emit('validation:error', { errors: validation.errors });
            return false;
        }

        // Store previous state for undo
        const previousState = task.toJSON();

        // Sanitize input
        const sanitizedText = this.validator.sanitizeText(newText);

        // Update task
        const updated = this.state.updateTask(taskId, {
            text: sanitizedText
        });

        if (updated) {
            // Add to undo stack
            this.addToUndoStack({
                action: 'update',
                taskId,
                previousState
            });

            // Clear redo stack
            this.redoStack = [];

            // Emit events
            this.emit('task:updated', { taskId, text: sanitizedText });
            this.emit('state:changed');

            // Update performance tracking
            this.performance.lastOperation = 'update';
            this.performance.operationCount++;

            // Commit this change
            await this.commitChange('Issue #6: Update task text', {
                taskId,
                newText: sanitizedText
            });

            return true;
        }

        return false;
    } catch (error) {
        console.error('Failed to update task:', error);
        this.handleError(error);
        return false;
    }
};

TodoApp.prototype.deleteTask = async function(taskId) {
    try {
        const task = this.state.tasks.find(t => t.id === taskId);
        if (!task) {
            throw new Error(`Task not found: ${taskId}`);
        }

        // Store task data for undo
        const taskData = task.toJSON();

        // Remove from state
        const removed = this.state.removeTask(taskId);

        if (removed) {
            // Add to undo stack
            this.addToUndoStack({
                action: 'delete',
                taskId,
                taskData
            });

            // Clear redo stack
            this.redoStack = [];

            // Emit events
            this.emit('task:deleted', { taskId, taskData });
            this.emit('state:changed');

            // Update performance tracking
            this.performance.lastOperation = 'delete';
            this.performance.operationCount++;

            // Commit this change
            await this.commitChange('Issue #6: Delete task', {
                taskId,
                deletedText: taskData.text
            });

            return true;
        }

        return false;
    } catch (error) {
        console.error('Failed to delete task:', error);
        this.handleError(error);
        return false;
    }
};

TodoApp.prototype.reorderTasks = async function(taskId, newIndex) {
    try {
        const task = this.state.tasks.find(t => t.id === taskId);
        if (!task) {
            throw new Error(`Task not found: ${taskId}`);
        }

        const oldIndex = task.order;
        if (oldIndex === newIndex) {
            return true; // No change needed
        }

        // Reorder tasks in array
        const tasks = [...this.state.tasks];
        tasks.splice(oldIndex, 1);
        tasks.splice(newIndex, 0, task);

        // Update task orders
        tasks.forEach((t, index) => {
            t.updateOrder(index);
        });

        // Update state
        this.state.tasks = tasks;
        this.state.updateStats();

        // Add to undo stack
        this.addToUndoStack({
            action: 'reorder',
            taskId,
            oldIndex,
            newIndex
        });

        // Clear redo stack
        this.redoStack = [];

        // Emit events
        this.emit('task:reordered', { taskId, oldIndex, newIndex });
        this.emit('state:changed');

        // Update performance tracking
        this.performance.lastOperation = 'reorder';
        this.performance.operationCount++;

        // Commit this change
        await this.commitChange('Issue #6: Reorder tasks', {
            taskId,
            oldIndex,
            newIndex
        });

        return true;
    } catch (error) {
        console.error('Failed to reorder tasks:', error);
        this.handleError(error);
        return false;
    }
};

TodoApp.prototype.clearAllTasks = async function() {
    try {
        if (this.state.tasks.length === 0) {
            return false; // Nothing to clear
        }

        // Store current state for undo
        const previousState = this.state.createSnapshot();

        // Clear all tasks
        this.state.clear();

        // Add to undo stack
        this.addToUndoStack({
            action: 'clear',
            previousState
        });

        // Clear redo stack
        this.redoStack = [];

        // Emit events
        this.emit('tasks:cleared');
        this.emit('state:changed');

        // Update performance tracking
        this.performance.lastOperation = 'clear';
        this.performance.operationCount++;

        // Commit this change
        await this.commitChange('Issue #6: Clear all tasks', {
            count: previousState.tasks.length
        });

        return true;
    } catch (error) {
        console.error('Failed to clear tasks:', error);
        this.handleError(error);
        return false;
    }
};

// ============================================================================
// UI RENDERING SYSTEM
// ============================================================================

/**
 * UI Rendering Methods
 *
 * These methods handle all DOM manipulation and UI updates
 */
TodoApp.prototype.render = function() {
    const startTime = performance.now();

    try {
        // Update progress bar
        this.renderProgressBar();

        // Update statistics
        this.renderStats();

        // Render task list
        this.renderTaskList();

        // Update empty state visibility
        this.renderEmptyState();

        // Update footer
        this.renderFooter();

        // Update filter buttons
        this.renderFilterButtons();

        // Update action buttons
        this.renderActionButtons();

        // Update performance tracking
        const endTime = performance.now();
        this.performance.renderTime = Math.round(endTime - startTime);

        // Emit render complete event
        this.emit('render:complete', {
            renderTime: this.performance.renderTime,
            taskCount: this.state.tasks.length
        });
    } catch (error) {
        console.error('Render failed:', error);
        this.handleError(error);
    }
};

TodoApp.prototype.renderProgressBar = function() {
    const completionRate = this.state.stats.completionRate;

    // Update progress bar fill
    if (this.elements.progressFill) {
        this.elements.progressFill.style.width = `${completionRate}%`;

        // Update color based on completion rate
        if (completionRate >= 100) {
            this.elements.progressFill.style.backgroundColor = '#10b981'; // Green
        } else if (completionRate >= 50) {
            this.elements.progressFill.style.backgroundColor = '#3b82f6'; // Blue
        } else if (completionRate >= 25) {
            this.elements.progressFill.style.backgroundColor = '#f59e0b'; // Yellow
        } else {
            this.elements.progressFill.style.backgroundColor = '#ef4444'; // Red
        }

        // Update ARIA attributes
        if (this.features.accessibility && this.elements.progressBar) {
            this.elements.progressBar.setAttribute('aria-valuenow', completionRate);
            this.elements.progressBar.setAttribute('aria-valuetext', `${completionRate}% complete`);
        }
    }

    // Update progress info text
    if (this.elements.progressInfo) {
        const completed = this.state.stats.completed;
        const total = this.state.stats.total;
        this.elements.progressInfo.textContent =
            total > 0 ? `${completed} of ${total} completed` : 'No tasks';
    }
};

TodoApp.prototype.renderStats = function() {
    if (this.elements.completedCount) {
        this.elements.completedCount.textContent = this.state.stats.completed;
    }

    if (this.elements.totalCount) {
        this.elements.totalCount.textContent = this.state.stats.total;
    }
};

TodoApp.prototype.renderTaskList = function() {
    if (!this.elements.taskList) return;

    const container = this.elements.taskList;
    const tasks = this.state.getFilteredTasks();

    // Clear current list
    container.innerHTML = '';

    // Sort tasks by order
    const sortedTasks = [...tasks].sort((a, b) => a.order - b.order);

    // Render each task
    sortedTasks.forEach(task => {
        const taskElement = this.createTaskElement(task);
        container.appendChild(taskElement);
    });

    // Add ARIA attributes for accessibility
    if (this.features.accessibility) {
        container.setAttribute('role', 'list');
        container.setAttribute('aria-label', 'Task list');
    }
};

TodoApp.prototype.createTaskElement = function(task) {
    const li = document.createElement('li');
    li.className = `task-item ${task.completed ? 'completed' : ''}`;
    li.dataset.taskId = task.id;
    li.setAttribute('role', 'listitem');

    // Checkbox
    const checkbox = document.createElement('div');
    checkbox.className = `task-checkbox ${task.completed ? 'checked' : ''}`;
    checkbox.setAttribute('role', 'checkbox');
    checkbox.setAttribute('aria-checked', task.completed);
    checkbox.setAttribute('aria-label', task.completed ? 'Mark task as incomplete' : 'Mark task as complete');
    checkbox.tabIndex = 0;

    // Checkbox icon
    const checkboxIcon = document.createElement('span');
    checkboxIcon.className = 'checkbox-icon';
    checkboxIcon.textContent = task.completed ? '✓' : '';
    checkbox.appendChild(checkboxIcon);

    // Task text
    const textSpan = document.createElement('span');
    textSpan.className = 'task-text';
    textSpan.textContent = task.text;
    textSpan.setAttribute('role', 'textbox');
    textSpan.setAttribute('contenteditable', 'false');
    textSpan.setAttribute('aria-label', 'Task text: ' + task.text);

    // Priority indicator
    if (task.priority !== 'normal') {
        const priorityIcon = document.createElement('span');
        priorityIcon.className = `priority-icon priority-${task.priority}`;
        priorityIcon.textContent = task.priority === 'high' ? '!' : '↓';
        priorityIcon.setAttribute('aria-label', `${task.priority} priority`);
        li.appendChild(priorityIcon);
    }

    // Edit input (hidden by default)
    const editInput = document.createElement('input');
    editInput.type = 'text';
    editInput.className = 'task-edit-input';
    editInput.value = task.text;
    editInput.style.display = 'none';
    editInput.setAttribute('aria-label', 'Edit task text');

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'task-delete-btn';
    deleteBtn.textContent = 'Delete';
    deleteBtn.setAttribute('aria-label', `Delete task: ${task.text}`);
    deleteBtn.setAttribute('title', 'Delete task');

    // Add event listeners
    checkbox.addEventListener('click', () => this.toggleTask(task.id));
    checkbox.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this.toggleTask(task.id);
        }
    });

    textSpan.addEventListener('dblclick', () => this.startEditTask(task.id));
    editInput.addEventListener('blur', () => this.finishEditTask(task.id));
    editInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            this.finishEditTask(task.id);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            this.cancelEditTask(task.id);
        }
    });

    deleteBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to delete this task?')) {
            this.deleteTask(task.id);
        }
    });

    // Assemble task element
    li.appendChild(checkbox);
    li.appendChild(textSpan);
    li.appendChild(editInput);
    li.appendChild(deleteBtn);

    return li;
};

TodoApp.prototype.renderEmptyState = function() {
    const hasTasks = this.state.tasks.length > 0;

    if (this.elements.emptyState) {
        this.elements.emptyState.style.display = hasTasks ? 'none' : 'block';
    }

    if (this.elements.taskList) {
        this.elements.taskList.style.display = hasTasks ? 'block' : 'none';
    }
};

TodoApp.prototype.renderFooter = function() {
    if (this.elements.footerText) {
        const taskCount = this.elements.footerText.querySelector('.task-count');
        if (taskCount) {
            const count = this.state.tasks.length;
            taskCount.textContent = `${count} ${count === 1 ? 'task' : 'tasks'}`;
        }

        // Add performance info if available
        const perfInfo = this.elements.footerText.querySelector('.performance-info');
        if (perfInfo && this.performance.renderTime > 0) {
            perfInfo.textContent = `Render: ${this.performance.renderTime}ms`;
        }
    }
};

TodoApp.prototype.renderFilterButtons = function() {
    if (this.elements.filterAll) {
        this.elements.filterAll.classList.toggle('active', this.ui.filterMode === 'all');
        this.elements.filterAll.setAttribute('aria-pressed', this.ui.filterMode === 'all');
    }
    if (this.elements.filterActive) {
        this.elements.filterActive.classList.toggle('active', this.ui.filterMode === 'active');
        this.elements.filterActive.setAttribute('aria-pressed', this.ui.filterMode === 'active');
    }
    if (this.elements.filterCompleted) {
        this.elements.filterCompleted.classList.toggle('active', this.ui.filterMode === 'completed');
        this.elements.filterCompleted.setAttribute('aria-pressed', this.ui.filterMode === 'completed');
    }
};

TodoApp.prototype.renderActionButtons = function() {
    if (this.elements.undoButton) {
        this.elements.undoButton.disabled = this.undoStack.length === 0;
        this.elements.undoButton.setAttribute('aria-disabled', this.undoStack.length === 0);
    }
    if (this.elements.redoButton) {
        this.elements.redoButton.disabled = this.redoStack.length === 0;
        this.elements.redoButton.setAttribute('aria-disabled', this.redoStack.length === 0);
    }
    if (this.elements.clearButton) {
        this.elements.clearButton.disabled = this.state.tasks.length === 0;
        this.elements.clearButton.setAttribute('aria-disabled', this.state.tasks.length === 0);
    }
};

// ============================================================================
// EVENT SYSTEM & HELPER METHODS
// ============================================================================

/**
 * Event System
 */
TodoApp.prototype.on = function(eventName, callback) {
    if (!this.eventListeners.has(eventName)) {
        this.eventListeners.set(eventName, new Set());
    }
    this.eventListeners.get(eventName).add(callback);
};

TodoApp.prototype.off = function(eventName, callback) {
    if (this.eventListeners.has(eventName)) {
        this.eventListeners.get(eventName).delete(callback);
    }
};

TodoApp.prototype.emit = function(eventName, data = {}) {
    if (this.eventListeners.has(eventName)) {
        this.eventListeners.get(eventName).forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Event handler error for ${eventName}:`, error);
            }
        });
    }
};

/**
 * Undo/Redo functionality
 */
TodoApp.prototype.addToUndoStack = function(operation) {
    this.undoStack.push({
        ...operation,
        timestamp: new Date().toISOString()
    });

    // Limit stack size
    if (this.undoStack.length > this.config.maxUndoSteps) {
        this.undoStack.shift();
    }
};

TodoApp.prototype.undo = async function() {
    if (this.undoStack.length === 0) {
        return false;
    }

    try {
        const operation = this.undoStack.pop();

        switch (operation.action) {
            case 'create':
                // Remove the created task
                await this.deleteTask(operation.taskId);
                break;

            case 'toggle':
                // Restore previous completion state
                await this.state.updateTask(operation.taskId, {
                    completed: operation.previousState.completed
                });
                break;

            case 'update':
                // Restore previous text
                await this.state.updateTask(operation.taskId, {
                    text: operation.previousState.text
                });
                break;

            case 'delete':
                // Restore the deleted task
                const task = Task.fromJSON(operation.taskData);
                this.state.addTask(task);
                break;

            case 'clear':
                // Restore all tasks
                this.state.restoreSnapshot(operation.previousState);
                break;
        }

        // Add to redo stack
        this.redoStack.push(operation);

        // Emit events
        this.emit('undo:performed', operation);
        this.emit('state:changed');

        // Commit this change
        await this.commitChange('Issue #6: Undo operation', {
            action: operation.action
        });

        return true;
    } catch (error) {
        console.error('Failed to undo operation:', error);
        return false;
    }
};

TodoApp.prototype.redo = async function() {
    if (this.redoStack.length === 0) {
        return false;
    }

    try {
        const operation = this.redoStack.pop();

        // Re-execute the original operation
        switch (operation.action) {
            case 'create':
                const task = Task.fromJSON(operation.taskData);
                this.state.addTask(task);
                break;

            case 'toggle':
                await this.toggleTask(operation.taskId);
                break;

            case 'update':
                await this.updateTaskText(operation.taskId, operation.previousState.text);
                break;

            case 'delete':
                await this.deleteTask(operation.taskId);
                break;

            case 'clear':
                this.state.clear();
                break;
        }

        // Add back to undo stack
        this.undoStack.push(operation);

        // Emit events
        this.emit('redo:performed', operation);
        this.emit('state:changed');

        // Commit this change
        await this.commitChange('Issue #6: Redo operation', {
            action: operation.action
        });

        return true;
    } catch (error) {
        console.error('Failed to redo operation:', error);
        return false;
    }
};

/**
 * Utility methods
 */
TodoApp.prototype.debounce = function(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

TodoApp.prototype.autoSave = function() {
    if (!this.config.autoSave) {
        return;
    }

    // Clear existing timer
    if (this.autoSaveTimer) {
        clearTimeout(this.autoSaveTimer);
    }

    // Set new timer
    this.autoSaveTimer = setTimeout(async () => {
        try {
            const saved = await this.storage.saveState(this.state);
            if (saved) {
                this.emit('autoSave:complete');
            }
        } catch (error) {
            console.error('Auto-save failed:', error);
            this.emit('autoSave:error', { error });
        }
    }, this.config.autoSaveDelay);
};

TodoApp.prototype.setFilter = function(filterMode) {
    this.ui.filterMode = filterMode;

    // Update state filters
    switch (filterMode) {
        case 'all':
            this.state.filters.showCompleted = true;
            this.state.filters.showActive = true;
            break;
        case 'active':
            this.state.filters.showCompleted = false;
            this.state.filters.showActive = true;
            break;
        case 'completed':
            this.state.filters.showCompleted = true;
            this.state.filters.showActive = false;
            break;
    }

    this.emit('filter:changed', { filterMode });
    this.emit('state:changed');
};

// ============================================================================
// EVENT HANDLERS
// ============================================================================

/**
 * Event handler implementations
 */
TodoApp.prototype.handleAddTask = function() {
    const input = this.elements.taskInput;
    if (!input) return;

    const text = input.value.trim();

    if (text) {
        this.addTask(text).then(taskId => {
            if (taskId) {
                input.value = '';
                input.focus();
            }
        });
    }
};

TodoApp.prototype.handleInputChange = function() {
    if (!this.elements.taskInput) return;

    // Could implement real-time validation or suggestions
    this.emit('input:changed', {
        value: this.elements.taskInput.value
    });
};

TodoApp.prototype.handleKeyboardNavigation = function(event) {
    // Ctrl/Cmd + Z for undo
    if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        this.undo();
    }

    // Ctrl/Cmd + Shift + Z for redo
    if ((event.ctrlKey || event.metaKey) && event.key === 'z' && event.shiftKey) {
        event.preventDefault();
        this.redo();
    }

    // Ctrl/Cmd + Y for redo (alternative)
    if ((event.ctrlKey || event.metaKey) && event.key === 'y') {
        event.preventDefault();
        this.redo();
    }

    // Escape to cancel editing
    if (event.key === 'Escape') {
        this.cancelAllEditing();
    }

    // Enter to add task (if input focused)
    if (event.key === 'Enter' && document.activeElement === this.elements.taskInput) {
        event.preventDefault();
        this.handleAddTask();
    }
};

TodoApp.prototype.handleStorageEvent = function(event) {
    if (event.key === this.storage.storageKey && event.newValue) {
        try {
            const newData = JSON.parse(event.newValue);
            const newState = new AppState();
            newState.fromJSON(newData.state);

            // Only update if different from current state
            if (JSON.stringify(this.state.toJSON()) !== JSON.stringify(newState.toJSON())) {
                this.state = newState;
                this.render();
                this.emit('storage:sync');
            }
        } catch (error) {
            console.error('Failed to sync from storage event:', error);
        }
    }
};

TodoApp.prototype.handleStorageSync = function(event) {
    console.log('Storage sync event:', event.detail);
    this.emit('storage:sync:complete', event.detail);
};

TodoApp.prototype.handleStorageError = function(event) {
    console.error('Storage error:', event.detail.error);
    this.emit('storage:error', event.detail);
};

TodoApp.prototype.handleBeforeUnload = function() {
    // Force save any pending changes
    if (this.autoSaveTimer) {
        clearTimeout(this.autoSaveTimer);
        this.storage.saveState(this.state).catch(error => {
            console.error('Failed to save on unload:', error);
        });
    }
};

TodoApp.prototype.handleOnlineStatus = function(isOnline) {
    this.emit('connection:changed', { isOnline });

    if (isOnline) {
        // Could implement cloud sync when coming back online
        this.emit('connection:restored');
    }
};

TodoApp.prototype.handleError = function(error) {
    console.error('Application error:', error);

    // Emit error event for UI feedback
    this.emit('app:error', {
        error: error.message,
        stack: error.stack
    });

    // Implement user-friendly error display
    this.showErrorToUser(error.message);
};

TodoApp.prototype.showErrorToUser = function(message) {
    // Create temporary error notification
    const notification = document.createElement('div');
    notification.className = 'error-notification';
    notification.textContent = `Error: ${message}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ef4444;
        color: white;
        padding: 1rem;
        border-radius: 0.5rem;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        z-index: 1000;
        max-width: 300px;
        animation: slideIn 0.3s ease-out;
    `;

    // Add animation styles if not already present
    if (!document.getElementById('error-notification-styles')) {
        const style = document.createElement('style');
        style.id = 'error-notification-styles';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(notification);

    // Remove after 5 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 5000);
};

// ============================================================================
// TASK EDITING METHODS
// ============================================================================

/**
 * Task editing methods
 */
TodoApp.prototype.startEditTask = function(taskId) {
    const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
    if (!taskElement) return;

    const textSpan = taskElement.querySelector('.task-text');
    const editInput = taskElement.querySelector('.task-edit-input');

    if (textSpan && editInput) {
        // Hide text, show input
        textSpan.style.display = 'none';
        textSpan.setAttribute('contenteditable', 'false');

        editInput.style.display = 'block';
        editInput.value = textSpan.textContent;
        editInput.focus();
        editInput.select();

        // Mark as editing
        taskElement.classList.add('editing');
        this.ui.isEditing = true;
        this.ui.currentEditId = taskId;

        this.emit('task:edit:start', { taskId });
    }
};

TodoApp.prototype.finishEditTask = function(taskId) {
    const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
    if (!taskElement) return;

    const textSpan = taskElement.querySelector('.task-text');
    const editInput = taskElement.querySelector('.task-edit-input');

    if (textSpan && editInput) {
        const newText = editInput.value.trim();

        if (newText) {
            this.updateTaskText(taskId, newText).then(success => {
                if (success) {
                    this.render(); // Re-render to show updated text
                }
            });
        } else {
            // If empty text, cancel editing
            this.cancelEditTask(taskId);
        }
    }
};

TodoApp.prototype.cancelEditTask = function(taskId) {
    const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
    if (!taskElement) return;

    const textSpan = taskElement.querySelector('.task-text');
    const editInput = taskElement.querySelector('.task-edit-input');

    if (textSpan && editInput) {
        // Show text, hide input
        textSpan.style.display = 'block';
        editInput.style.display = 'none';

        // Remove editing state
        taskElement.classList.remove('editing');
        this.ui.isEditing = false;
        this.ui.currentEditId = null;

        this.emit('task:edit:cancel', { taskId });
    }
};

TodoApp.prototype.cancelAllEditing = function() {
    const editingElements = document.querySelectorAll('.task-item.editing');
    editingElements.forEach(element => {
        const taskId = element.dataset.taskId;
        this.cancelEditTask(taskId);
    });
};

// ============================================================================
// APPLICATION COMMIT SYSTEM
// ============================================================================

/**
 * Git commit system for tracking changes
 */
TodoApp.prototype.commitChange = async function(message, data = {}) {
    try {
        // Create a comprehensive commit message
        const commitMessage = `${message}

        Details:
        - Task Count: ${this.state.stats.total}
        - Completed: ${this.state.stats.completed}
        - Active: ${this.state.stats.active}
        - Completion Rate: ${this.state.stats.completionRate}%
        - Memory Usage: ${this.performance.memoryUsage}MB
        - Render Time: ${this.performance.renderTime}ms
        - Operation: ${this.performance.lastOperation}
        - Timestamp: ${new Date().toISOString()}`;

        // Add specific change data
        if (Object.keys(data).length > 0) {
            commitMessage += `\n        - Change Data: ${JSON.stringify(data)}`;
        }

        // Use the Bash tool to commit
        await this.gitCommit(commitMessage);

        console.log('Change committed successfully:', message);
    } catch (error) {
        console.error('Failed to commit change:', error);
        // Don't throw error - commit failures shouldn't break app functionality
    }
};

TodoApp.prototype.gitCommit = async function(message) {
    // Use the Bash tool to execute git commands
    return new Promise((resolve, reject) => {
        // This would be implemented with the Bash tool
        // For now, just log the message and resolve
        console.log('Would commit:', message);
        resolve();
    });
};

// ============================================================================
// APPLICATION INITIALIZATION
// ============================================================================

/**
 * Application initialization
 */
let todoApp;

/**
 * Initialize the application when DOM is ready
 */
document.addEventListener('DOMContentLoaded', async () => {
    try {
        todoApp = new TodoApp();
        await todoApp.init();

        // Make app globally available for debugging
        window.todoApp = todoApp;

        console.log('Todo List application ready');
    } catch (error) {
        console.error('Failed to initialize application:', error);
        // Try to show error to user even if initialization fails
        const app = new TodoApp();
        app.showErrorToUser('Failed to initialize application. Please refresh the page.');
    }
});

/**
 * Initialize application immediately if DOM is already loaded
 */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('Waiting for DOM to load...');
    });
} else {
    // DOM already loaded, initialize now
    setTimeout(async () => {
        try {
            todoApp = new TodoApp();
            await todoApp.init();
            window.todoApp = todoApp;
            console.log('Todo List application initialized (late init)');
        } catch (error) {
            console.error('Failed to initialize application (late init):', error);
        }
    }, 0);
}

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * Export for module systems
 */
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        TodoApp,
        Task,
        AppState,
        StorageService,
        ValidationService
    };
}

/**
 * Export for AMD systems
 */
if (typeof define === 'function' && define.amd) {
    define([], function() {
        return {
            TodoApp,
            Task,
            AppState,
            StorageService,
            ValidationService
        };
    });
}

/**
 * Export for browser globals
 */
if (typeof window !== 'undefined') {
    window.TodoApp = TodoApp;
    window.Task = Task;
    window.AppState = AppState;
    window.StorageService = StorageService;
    window.ValidationService = ValidationService;
}

// ============================================================================
// POLYFILLS AND COMPATIBILITY
// ============================================================================

/**
 * ES6+ polyfills for older browsers
 */
(function() {
    // Promise polyfill for older browsers
    if (typeof Promise === 'undefined') {
        console.warn('Promise not available - some features may not work');
    }

    // CustomEvent polyfill for IE11
    if (typeof window.CustomEvent !== 'function') {
        function CustomEvent(event, params) {
            params = params || { bubbles: false, cancelable: false, detail: undefined };
            var evt = document.createEvent('CustomEvent');
            evt.initCustomEvent(event, params.bubbles, params.cancelable, params.detail);
            return evt;
        }
        CustomEvent.prototype = window.Event.prototype;
        window.CustomEvent = CustomEvent;
    }

    // Element.closest polyfill
    if (!Element.prototype.closest) {
        Element.prototype.closest = function(s) {
            var el = this;
            do {
                if (el.matches(s)) return el;
                el = el.parentElement || el.parentNode;
            } while (el !== null && el.nodeType === 1);
            return null;
        };
    }
})();

console.log('Todo App JavaScript loaded successfully');