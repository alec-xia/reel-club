export class AuthError extends Error {
  code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = "AuthError"
    this.code = code
  }
}

export class ClubError extends Error {
  code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = "ClubError"
    this.code = code
  }
}
