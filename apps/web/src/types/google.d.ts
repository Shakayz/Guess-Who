interface GoogleTokenClient {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void
}

interface GoogleAccounts {
  oauth2: {
    initTokenClient: (config: {
      client_id: string
      scope: string
      callback: (response: { access_token?: string; error?: string }) => void
    }) => GoogleTokenClient
  }
}

interface Window {
  google?: { accounts: GoogleAccounts }
}
