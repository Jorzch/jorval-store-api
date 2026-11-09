export abstract class iEntity {
  abstract get toSafeObject(): unknown;

  toJSON() {
    return this.toSafeObject;
  }
}
