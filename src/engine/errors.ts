/**
 * Engine-wide error type. Lives in its own module so the state layer
 * (piles) and the action layer (actions) can both raise it without
 * importing each other.
 */
export class EngineError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EngineError'
  }
}
