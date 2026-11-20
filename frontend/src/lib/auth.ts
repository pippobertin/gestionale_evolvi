import { AuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { accessoScaduto } from '@/lib/accessoUtente'

async function refreshAccessToken(token: any) {
  try {
    const url = "https://oauth2.googleapis.com/token?" +
      new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
      })

    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      method: "POST",
    })

    const refreshedTokens = await response.json()

    if (!response.ok) {
      throw refreshedTokens
    }

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
    }
  } catch (error) {
    console.error('Error refreshing access token:', error)
    return {
      ...token,
      error: "RefreshAccessTokenError",
    }
  }
}

export const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: [
            'openid',
            'email',
            'profile',
            'https://www.googleapis.com/auth/gmail.send',
            'https://www.googleapis.com/auth/drive',
            'https://www.googleapis.com/auth/drive.file',
            'https://www.googleapis.com/auth/drive.readonly',
            'https://www.googleapis.com/auth/calendar',
            'https://www.googleapis.com/auth/calendar.events'
          ].join(' '),
          access_type: "offline",
          prompt: "consent",
        }
      }
    })
  ],
  callbacks: {
    // Accesso con Google consentito solo a utenti già censiti e attivi nel gestionale.
    // Nessun utente viene creato automaticamente: lo crea un amministratore.
    async signIn({ user }) {
      const email = user?.email?.toLowerCase()
      if (!email) return false
      const { data, error } = await supabaseAdmin
        .from('scadenze_bandi_utenti')
        .select('id, accesso_fino_al')
        .eq('email', email)
        .eq('attivo', true)
        .maybeSingle()
      if (error || !data || accessoScaduto(data.accesso_fino_al)) {
        console.warn('[auth] Accesso Google rifiutato: utente non censito, non attivo o con accesso scaduto')
        return false
      }
      return true
    },
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
        token.accessTokenExpires = account.expires_at ? account.expires_at * 1000 : Date.now() + 3600 * 1000
      }

      if (Date.now() < (token.accessTokenExpires as number)) {
        return token
      }

      console.log('🔄 Token scaduto, tentativo refresh automatico...')
      return refreshAccessToken(token)
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken
      session.refreshToken = token.refreshToken
      session.error = token.error
      return session
    },
  },
  pages: {
    signIn: '/',
    error: '/',
  }
}