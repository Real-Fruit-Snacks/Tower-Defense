import { Element, ELEMENT_WHEEL, EFFECTIVENESS, ELEMENT_COLORS } from '../constants';

export class ElementSystem {
  /** Get damage multiplier for attacker vs defender element */
  static getEffectiveness(attackElement: Element | null, defenseElement: Element): number {
    if (!attackElement) return EFFECTIVENESS.NEUTRAL;

    const atkIndex = ELEMENT_WHEEL.indexOf(attackElement);
    const defIndex = ELEMENT_WHEEL.indexOf(defenseElement);

    if (atkIndex === -1 || defIndex === -1) return EFFECTIVENESS.NEUTRAL;

    // Each element beats its clockwise neighbor
    if ((atkIndex + 1) % 6 === defIndex) return EFFECTIVENESS.STRONG;
    // Each element is weak against its counter-clockwise neighbor
    if ((defIndex + 1) % 6 === atkIndex) return EFFECTIVENESS.WEAK;

    return EFFECTIVENESS.NEUTRAL;
  }

  /** Get what element this one is strong against */
  static getCounterElement(element: Element): Element {
    const index = ELEMENT_WHEEL.indexOf(element);
    return ELEMENT_WHEEL[(index + 1) % 6]!;
  }

  /** Get what element this one is weak against */
  static getWeakness(element: Element): Element {
    const index = ELEMENT_WHEEL.indexOf(element);
    return ELEMENT_WHEEL[(index + 5) % 6]!; // -1 mod 6
  }

  /** Get the color associated with an element */
  static getColor(element: Element | null): number {
    if (!element) return 0x888888;
    return ELEMENT_COLORS[element];
  }

  /** Get a human-readable effectiveness string */
  static getEffectivenessLabel(multiplier: number): string {
    if (multiplier > 1) return 'STRONG';
    if (multiplier < 1) return 'WEAK';
    return '';
  }
}
