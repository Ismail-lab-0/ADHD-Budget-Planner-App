// A small factory for the common "flat list of id-keyed entities with
// create/update/delete/toggle" reducer shape shared by several budget
// modules (Income, Bills, Planned Expenses). Not product-specific — lives
// in /core because it's generic reducer-building logic, same spirit as
// src/core/store.js. See docs/ARCHITECTURE.md §4 (reducers must return the
// same array reference for a no-op) and §7 (module boundaries).

/**
 * @param {object} options
 * @param {string} options.actionPrefix e.g. 'incomes' — actions are
 *   `${actionPrefix}/create|update|delete|toggle`.
 * @param {string} options.entityKey the property on the create action
 *   holding the candidate entity, e.g. 'income'.
 * @param {(candidate: object) => object|null} options.validateNew returns
 *   a cleaned entity to accept, or null to reject (reducer no-op).
 * @param {(changes: object) => object} options.sanitizeChanges whitelists/
 *   validates an update action's `changes`, dropping anything invalid.
 */
export function createListReducer({ actionPrefix, entityKey, validateNew, sanitizeChanges }) {
  return function listReducer(items = [], action) {
    switch (action.type) {
      case `${actionPrefix}/create`: {
        const entity = validateNew(action[entityKey]);
        if (!entity) return items;
        return [...items, entity];
      }

      case `${actionPrefix}/update`: {
        const index = items.findIndex((item) => item.id === action.id);
        if (index === -1) return items;
        const changes = sanitizeChanges(action.changes);
        if (Object.keys(changes).length === 0) return items;
        const next = items.slice();
        next[index] = { ...items[index], ...changes, updatedAt: action.now };
        return next;
      }

      case `${actionPrefix}/delete`: {
        const index = items.findIndex((item) => item.id === action.id);
        if (index === -1) return items;
        return items.filter((item) => item.id !== action.id);
      }

      case `${actionPrefix}/toggle`: {
        const index = items.findIndex((item) => item.id === action.id);
        if (index === -1) return items;
        const current = items[index];
        const next = items.slice();
        next[index] = { ...current, [action.field]: !current[action.field], updatedAt: action.now };
        return next;
      }

      default:
        return items;
    }
  };
}
