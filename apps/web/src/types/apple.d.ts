interface AppleIDAuth {
  init(config: {
    clientId: string
    scope: string
    redirectURI: string
    usePopup?: boolean
    state?: string
  }): void
  signIn(): Promise<{
    authorization: { id_token: string; code: string }
    user?: {
      email?: string
      name?: { firstName?: string; lastName?: string }
    }
  }>
}

/** Error surfaced when Apple sign-in fails (e.g. popup closed, invalid_client). */
interface AppleIDSignInError {
  error?: string
  details?: string
}

interface Window {
  AppleID?: { auth: AppleIDAuth }
}
