'use strict';

const Policy = require('./policy');
const Operation = require('./operation');
const Rule = require('./rule');

class Enforcer {
  constructor() {
    this.policies = [];
  }

  addPolicy(policy) {
    Enforcer.validateProps(policy);

    this.policies.push(policy);
  }

  isAllowed(operation) {
    for (const p of this.policies) {
      try {
        Enforcer.checkPolicy(operation, p);
        return true;
      } catch (e) {}
    }
    return false;
  }

  /**
   * Checks if the operation is allowed according to the given policy.
   *
   * @param operation {Operation} The attempted operation.
   * @param policy {Policy} The policy to enforce.
   * @returns {boolean} whether the operation is allowed.
   */
  static checkPolicy(operation, policy) {
    if (!(operation instanceof Operation)) {
      throw new Error(
        `Invalid operation: ${operation}. Expected an operation object.`,
      );
    }

    const effect = policy.effect.isAllowed();

    if (policy.actions) {
      if (!Enforcer.validateOneInArray(policy.actions, operation.action)) {
        return !effect;
      }
    }

    if (policy.subjects) {
      if (!Enforcer.validateOneInArray(policy.subjects, operation.subject)) {
        return !effect;
      }
    }

    if (policy.resources) {
      if (!Enforcer.validateOneInArray(policy.resources, operation.resource)) {
        return !effect;
      }
    }

    if (policy.context) {
      try {
        Enforcer.recursivelyValidateParallel(policy.context, operation.context);
      } catch (e) {
        return !effect;
      }
    }

    return effect;
  }

  /**
   * Checks if the operation data is allowed by at least one of the rules in the
   * array.
   *
   * @param array {Rule[]} The array of rules.
   * @param opData {any} The operation data.
   * @returns {boolean} whether the operation data is allowed.
   */
  static validateOneInArray(array, opData) {
    for (const rule of array) {
      try {
        Enforcer.recursivelyValidateParallel(rule, opData);
        // Subject validation passes if at least one subject matches.
        return true;
      } catch (e) {}
    }
    return false;
  }

  static recursivelyValidateParallel(rule, opData) {
    if (!rule) {
      throw new Error(
        'Recursive parallel validation requires a rule to enforce.',
      );
    }
    if (!opData) {
      throw new Error(
        'Recursive parallel validation requires operation data to check.',
      );
    }
    if (rule instanceof Rule) {
      const valid = rule.validate(opData);
      if (!valid) {
        throw new Error('Rule validation failed.');
      }
    }
    if (opData.constructor === Object && rule.constructor === Object) {
      if (Object.keys(opData).length !== Object.keys(rule).length) {
        throw new Error('Mismatched number of attributes.');
      }
      if (
        !Object.keys(opData).every(k => Object.keys(rule).indexOf(k) !== -1)
      ) {
        throw new Error('Attribute names do not match.');
      }
      for (const k of Object.keys(opData)) {
        Enforcer.recursivelyValidateParallel(rule[k], opData[k]);
      }
    }
  }

  static validateProps(policy) {
    if (!policy) {
      throw new Error('Enforcer requires a policy to enforce.');
    }
    if (!(policy instanceof Policy)) {
      throw new Error(`Invalid policy: ${policy}. Expected a policy object.`);
    }
  }
}

module.exports = Enforcer;
