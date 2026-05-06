import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyJWT } from '@/lib/jwtAuth'

interface Notification {
  id: string
  title: string
  message: string
  time: string
  type: 'warning' | 'success' | 'info'
  unread: boolean
  link?: string
}

function getRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMinutes < 60) {
    return `${diffMinutes} minut${diffMinutes === 1 ? 'o' : 'i'} fa`
  } else if (diffHours < 24) {
    return `${diffHours} or${diffHours === 1 ? 'a' : 'e'} fa`
  } else if (diffDays < 7) {
    return `${diffDays} giorn${diffDays === 1 ? 'o' : 'i'} fa`
  } else {
    return date.toLocaleDateString('it-IT')
  }
}

function getGiorniRimanenti(dataScadenza: string): number {
  const oggi = new Date()
  oggi.setHours(0, 0, 0, 0)
  const scadenza = new Date(dataScadenza)
  scadenza.setHours(0, 0, 0, 0)
  return Math.ceil((scadenza.getTime() - oggi.getTime()) / (1000 * 60 * 60 * 24))
}

export async function GET(request: NextRequest) {
  try {
    // Get logged-in user ID
    const decoded = await verifyJWT(request)
    const userEmail = decoded?.email

    const notifications: Notification[] = []

    // 1. Recupera scadenze imminenti (prossimi 15 giorni)
    const today = new Date()
    const in15Days = new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000)

    const { data: scadenze, error: scadenzeError } = await supabase
      .from('scadenze_bandi_scadenze')
      .select(`
        id,
        titolo,
        data_scadenza,
        priorita,
        created_at,
        scadenze_bandi_clienti(denominazione),
        scadenze_bandi_progetti(titolo_progetto)
      `)
      .in('stato', ['non_iniziata', 'in_corso'])
      .gte('data_scadenza', today.toISOString().split('T')[0])
      .lte('data_scadenza', in15Days.toISOString().split('T')[0])
      .order('data_scadenza', { ascending: true })
      .limit(10)

    if (!scadenzeError && scadenze) {
      for (const scadenza of scadenze) {
        const giorniRimanenti = getGiorniRimanenti(scadenza.data_scadenza)
        const clienteNome = scadenza.scadenze_bandi_clienti?.denominazione || 'Cliente N/A'
        const progettoTitolo = scadenza.scadenze_bandi_progetti?.titolo_progetto || ''

        let message = `${scadenza.titolo} - ${clienteNome}`
        if (progettoTitolo) {
          message += ` - ${progettoTitolo}`
        }
        message += ` scade ${giorniRimanenti === 0 ? 'oggi' : giorniRimanenti === 1 ? 'domani' : `tra ${giorniRimanenti} giorni`}`

        notifications.push({
          id: `scadenza-${scadenza.id}`,
          title: giorniRimanenti <= 2 ? 'Scadenza imminente' : 'Prossima scadenza',
          message,
          time: getRelativeTime(new Date(scadenza.created_at)),
          type: giorniRimanenti <= 2 ? 'warning' : giorniRimanenti <= 7 ? 'info' : 'info',
          unread: giorniRimanenti <= 3, // Mark as unread if deadline is within 3 days
          link: `/scadenze/${scadenza.id}`
        })
      }
    }

    // 1b. Recupera scadenze contrattuali imminenti (prossimi 15 giorni)
    const { data: scadenzeContrattuali, error: scContrError } = await supabase
      .from('scadenze_bandi_scadenze_contrattuali')
      .select('id, titolo, descrizione, data_scadenza, priorita, tipo_scadenza, responsabile_email, created_at')
      .in('stato', ['APERTA', 'IN_CORSO'])
      .gte('data_scadenza', today.toISOString().split('T')[0])
      .lte('data_scadenza', in15Days.toISOString().split('T')[0])
      .order('data_scadenza', { ascending: true })
      .limit(15)

    if (!scContrError && scadenzeContrattuali) {
      for (const sc of scadenzeContrattuali) {
        // If user is logged in, show their scadenze, unassigned ones, and group-assigned ones
        // GRUPPO: prefix means assigned to a team (e.g. "GRUPPO:Team Amministrativo") → visible to all
        if (userEmail && sc.responsabile_email && !sc.responsabile_email.startsWith('GRUPPO:') && sc.responsabile_email !== userEmail) {
          continue
        }

        const giorniRimanenti = getGiorniRimanenti(sc.data_scadenza)

        notifications.push({
          id: `sc-contr-${sc.id}`,
          title: giorniRimanenti <= 2 ? 'Scadenza imminente' : 'Prossima scadenza',
          message: `${sc.titolo}${giorniRimanenti === 0 ? ' — oggi' : giorniRimanenti === 1 ? ' — domani' : ` — tra ${giorniRimanenti} giorni`}`,
          time: getRelativeTime(new Date(sc.created_at)),
          type: giorniRimanenti <= 2 ? 'warning' : 'info',
          unread: giorniRimanenti <= 3,
          link: '/scadenze-contrattuali'
        })
      }
    }

    // 2. Recupera progetti recenti (ultimi 7 giorni)
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)

    const { data: progetti, error: progettiError } = await supabase
      .from('scadenze_bandi_progetti')
      .select(`
        id,
        titolo_progetto,
        created_at,
        updated_at,
        scadenze_bandi_clienti(denominazione)
      `)
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(5)

    if (!progettiError && progetti) {
      for (const progetto of progetti) {
        const clienteNome = progetto.scadenze_bandi_clienti?.denominazione || 'Cliente N/A'

        notifications.push({
          id: `progetto-${progetto.id}`,
          title: 'Nuovo progetto creato',
          message: `${progetto.titolo_progetto} - ${clienteNome}`,
          time: getRelativeTime(new Date(progetto.created_at)),
          type: 'success',
          unread: true,
          link: `/progetti/${progetto.id}`
        })
      }
    }

    // 3. Recupera bandi recenti (ultimi 7 giorni)
    const { data: bandi, error: bandiError } = await supabase
      .from('scadenze_bandi_bandi')
      .select(`
        id,
        titolo_bando,
        ente_erogatore,
        created_at
      `)
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(3)

    if (!bandiError && bandi) {
      for (const bando of bandi) {
        notifications.push({
          id: `bando-${bando.id}`,
          title: 'Nuovo bando disponibile',
          message: `${bando.titolo_bando} - ${bando.ente_erogatore}`,
          time: getRelativeTime(new Date(bando.created_at)),
          type: 'info',
          unread: true,
          link: `/bandi/${bando.id}`
        })
      }
    }

    // Sort notifications by unread first, then by most recent
    notifications.sort((a, b) => {
      if (a.unread === b.unread) {
        // If both have same unread status, sort by time (most recent first)
        return 0 // They're already sorted by creation time from queries
      }
      return a.unread ? -1 : 1 // Unread notifications first
    })

    const unreadCount = notifications.filter(n => n.unread).length

    return NextResponse.json({
      success: true,
      notifications: notifications.slice(0, 20), // Limit to 20 most important notifications
      unreadCount
    })

  } catch (error: any) {
    console.error('Error fetching recent notifications:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Errore durante il caricamento delle notifiche',
      notifications: [],
      unreadCount: 0
    }, { status: 500 })
  }
}
