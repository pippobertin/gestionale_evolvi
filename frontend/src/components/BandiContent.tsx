'use client'

import React, { useState, useEffect } from 'react'
import { Search, Plus, Filter, Calendar, Euro, Building, FileText, ExternalLink, Upload, Eye, Edit, Rocket, Trash2, CheckSquare, Square, Settings } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import BandoForm from './BandoForm'
import ProgettoForm from './ProgettoForm'
import DocumentTemplateEditor from './DocumentTemplateEditor'

interface Bando {
  id: string
  codice_bando: string
  nome: string
  descrizione: string
  ente_erogatore: string
  tipologia_bando: string
  contributo_massimo: number
  budget_totale: number
  percentuale_contributo: number
  data_pubblicazione: string
  data_apertura_presentazione: string
  data_chiusura_presentazione: string
  tempo_valutazione_giorni: number
  tipo_valutazione: 'A_PUNTEGGIO' | 'JUST_IN_TIME'
  stato_bando: string
  stato_calcolato: string
  link_bando_ufficiale: string
  settori_ammessi: string[]
  dimensioni_aziendali_ammesse: string[]
  localizzazione_geografica: string
  note_interne: string
  referente_bando: string
  email_referente: string
  giorni_ad_apertura: number
  giorni_a_chiusura: number
  progetti_collegati: number
  progetti_attivi: number
  documenti_caricati: number
  created_at: string
  updated_at: string
}

export default function BandiContent() {
  const [bandi, setBandi] = useState<Bando[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filtroStato, setFiltroStato] = useState<string>('tutti')
  const [filtroTipo, setFiltroTipo] = useState<string>('tutti')
  const [showNewBandoModal, setShowNewBandoModal] = useState(false)
  const [showEditBandoModal, setShowEditBandoModal] = useState(false)
  const [showProgettoModal, setShowProgettoModal] = useState(false)
  const [selectedBando, setSelectedBando] = useState<Bando | null>(null)
  const [editingBando, setEditingBando] = useState<Bando | null>(null)
  const [progettoFromBando, setProgettoFromBando] = useState<Bando | null>(null)
  const [selectedBandiForDelete, setSelectedBandiForDelete] = useState<Set<string>>(new Set())
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [bandoToDelete, setBandoToDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [activeTab, setActiveTab] = useState<'info' | 'template'>('info')

  // Carica bandi
  useEffect(() => {
    fetchBandi()
  }, [])

  const fetchBandi = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('scadenze_bandi_bandi_view')
        .select('*')
        .order('data_chiusura_presentazione', { ascending: true })

      if (error) throw error

      setBandi(data || [])
    } catch (err: any) {
      console.error('Errore nel caricamento bandi:', err)
      setError('Errore nel caricamento dei bandi')
    } finally {
      setLoading(false)
    }
  }

  // Filtra bandi
  const bandiFiltrati = bandi.filter(bando => {
    if (searchTerm && !bando.nome.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !bando.codice_bando?.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !bando.ente_erogatore?.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false
    }
    if (filtroStato !== 'tutti' && bando.stato_calcolato !== filtroStato) {
      return false
    }
    if (filtroTipo !== 'tutti' && bando.tipologia_bando !== filtroTipo) {
      return false
    }
    return true
  })

  // Raggruppa bandi per stato
  const bandiAperti = bandiFiltrati.filter(b => b.stato_calcolato === 'APERTO')
  const bandiProssimi = bandiFiltrati.filter(b => b.stato_calcolato === 'PROSSIMA_APERTURA')
  const bandiInValutazione = bandiFiltrati.filter(b => b.stato_calcolato === 'IN_VALUTAZIONE')
  const bandiChiusi = bandiFiltrati.filter(b => b.stato_calcolato === 'CHIUSO')

  // Tipi di bando unici per filtro
  const tipiBando = [...new Set(bandi.map(b => b.tipologia_bando).filter(Boolean))]

  const getStatoColor = (stato: string) => {
    switch (stato) {
      case 'APERTO': return 'bg-green-100 text-green-800 border-green-200'
      case 'PROSSIMA_APERTURA': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'IN_VALUTAZIONE': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'CHIUSO': return 'bg-gray-100 text-gray-800 border-gray-200'
      default: return 'bg-gray-100 text-gray-600 border-gray-200'
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/D'
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const formatCurrency = (amount: number) => {
    if (!amount) return 'N/D'
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0
    }).format(amount)
  }

  const handleBandoCreated = () => {
    fetchBandi() // Ricarica la lista bandi
    setShowNewBandoModal(false) // Chiude il modale
    setShowEditBandoModal(false) // Chiude anche il modale di modifica
  }

  const handleEditBando = (bando: Bando) => {
    setEditingBando(bando)
    setShowEditBandoModal(true)
  }

  const handleCreateProgetto = (bando: Bando) => {
    setProgettoFromBando(bando)
    setShowProgettoModal(true)
  }

  const handleProgettoCreated = () => {
    fetchBandi() // Ricarica per aggiornare contatori progetti
    setShowProgettoModal(false)
    setProgettoFromBando(null)
  }

  const handleTemplateSelect = (bando: Bando) => {
    setSelectedBando(bando)
    setActiveTab('template')
  }

  const saveDocumentTemplate = async (templateData: any) => {
    try {
      console.log('💾 Salvando template documento per bando:', templateData.bando_id)

      // Sistema template multipli per bando
      const templateId = `${templateData.bando_id}_${Date.now()}_${templateData.file_name.replace(/[^a-zA-Z0-9]/g, '_')}`

      // Salva il singolo template con ID univoco
      const templateWithId = {
        ...templateData,
        template_id: templateId,
        saved_at: new Date().toISOString()
      }
      localStorage.setItem(`template_${templateId}`, JSON.stringify(templateWithId))

      // Mantieni lista dei template per questo bando
      const templatesListKey = `templates_list_${templateData.bando_id}`
      const existingTemplates = JSON.parse(localStorage.getItem(templatesListKey) || '[]')

      // Aggiungi nuovo template alla lista (sostituisci se stesso nome file)
      const newTemplateRef = {
        template_id: templateId,
        file_name: templateData.file_name,
        saved_at: new Date().toISOString(),
        placeholders_count: templateData.placeholders_used?.length || 0
      }

      const filteredTemplates = existingTemplates.filter(t => t.file_name !== templateData.file_name)
      filteredTemplates.push(newTemplateRef)

      localStorage.setItem(templatesListKey, JSON.stringify(filteredTemplates))

      // Mantieni compatibilità: salva anche con chiave vecchia (ultimo template)
      localStorage.setItem(`template_${templateData.bando_id}`, JSON.stringify(templateData))

      console.log('✅ Template salvato con ID:', templateId)
      console.log('📋 Templates totali per bando:', filteredTemplates.length)

      // ⚠️ La tabella scadenze_bandi_documento_templates non esiste
      // Per ora usiamo solo localStorage fino a quando non viene creata la struttura DB

      console.log('✅ Template salvato con successo!')
      alert('✅ Template documento salvato!\n\nIl template sarà disponibile quando crei un progetto da questo bando.')

    } catch (err) {
      console.error('❌ Errore nel salvataggio template:', err)
      alert('❌ Errore nel salvataggio del template. Riprova.')
    }
  }

  const handleDeleteBando = (bandoId: string) => {
    setBandoToDelete(bandoId)
    setShowDeleteConfirm(true)
  }

  const handleBulkDelete = () => {
    if (selectedBandiForDelete.size > 0) {
      setShowDeleteConfirm(true)
    }
  }

  const confirmDelete = async () => {
    setDeleting(true)
    try {
      const bandiIds = bandoToDelete ? [bandoToDelete] : Array.from(selectedBandiForDelete)

      console.log('Eliminando bandi con cascade:', bandiIds)

      // Per ogni bando, elimina prima tutti i progetti collegati (con le loro scadenze)
      for (const bandoId of bandiIds) {
        // 1. Trova tutti i progetti collegati a questo bando
        const { data: progetti, error: progettiError } = await supabase
          .from('scadenze_bandi_progetti')
          .select('id')
          .eq('bando_id', bandoId)

        if (progettiError) {
          console.error('Errore nel trovare progetti collegati:', progettiError)
          throw progettiError
        }

        // 2. Per ogni progetto, elimina prima tutte le scadenze collegate
        for (const progetto of progetti || []) {
          const { error: scadenzeError } = await supabase
            .from('scadenze_bandi_scadenze')
            .delete()
            .eq('progetto_id', progetto.id)

          if (scadenzeError) {
            console.error('Errore eliminazione scadenze progetto:', scadenzeError)
            throw scadenzeError
          }
        }

        // 3. Elimina tutti i progetti collegati al bando
        if (progetti && progetti.length > 0) {
          const { error: deleteProgettiError } = await supabase
            .from('scadenze_bandi_progetti')
            .delete()
            .eq('bando_id', bandoId)

          if (deleteProgettiError) {
            console.error('Errore eliminazione progetti:', deleteProgettiError)
            throw deleteProgettiError
          }
        }

        // 4. Elimina i template di scadenze del bando
        const { error: templateError } = await supabase
          .from('scadenze_bandi_template_scadenze')
          .delete()
          .eq('bando_id', bandoId)

        if (templateError) {
          console.error('Errore eliminazione template:', templateError)
          // Non lanciamo l'errore perché i template potrebbero non esistere
        }
      }

      // 5. Finalmente elimina i bandi
      const { error: bandiError } = await supabase
        .from('scadenze_bandi_bandi')
        .delete()
        .in('id', bandiIds)

      if (bandiError) {
        console.error('Errore eliminazione bandi:', bandiError)
        throw bandiError
      }

      // Reset stati
      if (bandoToDelete) {
        setBandoToDelete(null)
      } else {
        setSelectedBandiForDelete(new Set())
        setIsSelectMode(false)
      }

      setShowDeleteConfirm(false)
      fetchBandi() // Ricarica la lista

      console.log(`✅ Eliminati con successo ${bandiIds.length} bandi e tutti i progetti collegati`)
    } catch (error: any) {
      console.error('Errore nell\'eliminazione:', error)
      alert(`Errore: ${error.message || 'Impossibile eliminare il bando'}`)
    } finally {
      setDeleting(false)
    }
  }

  const toggleSelectBando = (bandoId: string) => {
    const newSelected = new Set(selectedBandiForDelete)
    if (newSelected.has(bandoId)) {
      newSelected.delete(bandoId)
    } else {
      newSelected.add(bandoId)
    }
    setSelectedBandiForDelete(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedBandiForDelete.size === bandiFiltrati.length) {
      setSelectedBandiForDelete(new Set())
    } else {
      setSelectedBandiForDelete(new Set(bandiFiltrati.map(b => b.id)))
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // Componente per visualizzare documenti del bando
  const BandoDocumentsTab: React.FC<{
    bandoId: string
    onTemplateSelect: (template: any) => void
  }> = ({ bandoId, onTemplateSelect }) => {
    const [documentiEsistenti, setDocumentiEsistenti] = useState<any[]>([])
    const [templateSalvati, setTemplateSalvati] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
      caricaDocumenti()
    }, [bandoId])

    const caricaDocumenti = async () => {
      setLoading(true)
      try {
        // Carica documenti esistenti dal database (per ora skip perché la tabella è vuota)
        // La tabella scadenze_bandi_documenti_progetto è per documenti di progetto, non di bando
        setDocumentiEsistenti([])

        console.log('🔍 Skipping documenti database - tabella vuota secondo documentazione')

        // Carica template salvati da localStorage
        const templateKey = `template_${bandoId}`
        const templateData = localStorage.getItem(templateKey)
        if (templateData) {
          const template = JSON.parse(templateData)
          console.log('🔍 Template trovato per bando', bandoId, ':', template)
          setTemplateSalvati([{
            id: 'template_' + bandoId,
            nome: template.fileName || 'Template Documento',
            contenuto: template.content,
            tipo: 'template',
            data_creazione: new Date().toISOString(),
            ...template
          }])
        } else {
          setTemplateSalvati([])
        }
      } catch (error) {
        console.error('Errore generale caricamento documenti:', error)
      } finally {
        setLoading(false)
      }
    }

    if (loading) {
      return (
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )
    }

    const totaleDocumenti = templateSalvati.length  // Solo template per ora

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">
            Documenti Bando ({totaleDocumenti})
          </h3>
        </div>

        {/* Template Salvati */}
        {templateSalvati.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-md font-medium text-purple-700 flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Template Documenti ({templateSalvati.length})
            </h4>
            <div className="bg-purple-50 border border-purple-200 rounded-lg">
              {templateSalvati.map((template, index) => (
                <div
                  key={template.id}
                  className="p-4 border-b last:border-b-0 border-purple-200"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h5 className="font-medium text-purple-900">
                        {template.nome || template.fileName || 'Template Documento'}
                      </h5>
                      <p className="text-sm text-purple-600 mt-1">
                        Salvato con editor template • Pronto per eredità ai progetti
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-block bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded">
                        Template
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Documenti Esistenti - Nascosto perché la tabella è vuota */}

        {/* Messaggio quando non ci sono documenti */}
        {totaleDocumenti === 0 && (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nessun documento presente
            </h3>
            <p className="text-gray-600 mb-4">
              Non ci sono ancora documenti per questo bando. Usa l'Editor Template per creare i primi documenti.
            </p>
            <button
              onClick={() => setActiveTab('template')}
              className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 mx-auto"
            >
              <Settings className="w-4 h-4" />
              Apri Editor Template
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Gestione Bandi</h1>
        <div className="flex items-center gap-3">
          {isSelectMode ? (
            <>
              {selectedBandiForDelete.size > 0 && (
                <button
                  onClick={handleBulkDelete}
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Elimina ({selectedBandiForDelete.size})
                </button>
              )}
              <button
                onClick={() => {
                  setIsSelectMode(false)
                  setSelectedBandiForDelete(new Set())
                }}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg"
              >
                Annulla
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsSelectMode(true)}
                className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
              >
                <CheckSquare className="w-4 h-4" />
                Seleziona
              </button>
              <button
                onClick={() => setShowNewBandoModal(true)}
                className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Nuovo Bando
              </button>
            </>
          )}
        </div>
      </div>

      {/* Statistiche Rapide */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600">Aperti</p>
              <p className="text-2xl font-bold text-green-900">{bandiAperti.length}</p>
            </div>
            <Calendar className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">In arrivo</p>
              <p className="text-2xl font-bold text-blue-900">{bandiProssimi.length}</p>
            </div>
            <Calendar className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-600">In valutazione</p>
              <p className="text-2xl font-bold text-orange-900">{bandiInValutazione.length}</p>
            </div>
            <Building className="w-8 h-8 text-orange-600" />
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Progetti attivi</p>
              <p className="text-2xl font-bold text-gray-900">
                {bandi.reduce((sum, b) => sum + (b.progetti_attivi || 0), 0)}
              </p>
            </div>
            <FileText className="w-8 h-8 text-gray-600" />
          </div>
        </div>
      </div>

      {/* Filtri e Ricerca */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Cerca bando, codice, ente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-80"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={filtroStato}
              onChange={(e) => setFiltroStato(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="tutti">Tutti gli stati</option>
              <option value="APERTO">Solo aperti</option>
              <option value="PROSSIMA_APERTURA">Prossima apertura</option>
              <option value="IN_VALUTAZIONE">In valutazione</option>
              <option value="CHIUSO">Chiusi</option>
            </select>
          </div>

          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="tutti">Tutte le tipologie</option>
            {tipiBando.map(tipo => (
              <option key={tipo} value={tipo}>{tipo}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Lista Bandi */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {isSelectMode && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                    <button
                      onClick={toggleSelectAll}
                      className="text-gray-600 hover:text-gray-800"
                    >
                      {selectedBandiForDelete.size === bandiFiltrati.length ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bando
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Scadenze
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contributo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stato
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Progetti
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Azioni
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {bandiFiltrati.map((bando) => (
                <tr key={bando.id} className="hover:bg-gray-50">
                  {isSelectMode && (
                    <td className="px-6 py-4 whitespace-nowrap w-12">
                      <button
                        onClick={() => toggleSelectBando(bando.id)}
                        className="text-gray-600 hover:text-gray-800"
                      >
                        {selectedBandiForDelete.has(bando.id) ? (
                          <CheckSquare className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {bando.nome}
                      </div>
                      <div className="text-sm text-gray-500">
                        {bando.codice_bando} • {bando.tipologia_bando}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {bando.ente_erogatore}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm">
                      <div>Apertura: <span className="font-medium">{formatDate(bando.data_apertura_presentazione)}</span></div>
                      <div>Chiusura: <span className="font-medium">{formatDate(bando.data_chiusura_presentazione)}</span></div>
                      {bando.giorni_a_chiusura !== null && bando.giorni_a_chiusura >= 0 && (
                        <div className="text-orange-600">Tra {bando.giorni_a_chiusura} giorni</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm">
                      <div>{formatCurrency(bando.contributo_massimo)}</div>
                      <div className="text-gray-500">{bando.percentuale_contributo}%</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getStatoColor(bando.stato_calcolato)}`}>
                      {bando.stato_calcolato.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="text-center">
                      <div className="font-medium">{bando.progetti_collegati || 0}</div>
                      <div className="text-gray-500 text-xs">
                        {bando.progetti_attivi || 0} attivi
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedBando(bando)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Visualizza dettagli"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEditBando(bando)}
                        className="text-orange-600 hover:text-orange-900"
                        title="Modifica bando"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      {(bando.stato_calcolato === 'CHIUSO' || bando.stato_calcolato === 'IN_VALUTAZIONE') && (
                        <button
                          onClick={() => handleCreateProgetto(bando)}
                          className="text-emerald-600 hover:text-emerald-900"
                          title="Crea progetto da bando vinto"
                        >
                          <Rocket className="w-4 h-4" />
                        </button>
                      )}
                      {bando.link_bando_ufficiale && (
                        <a
                          href={bando.link_bando_ufficiale}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-600 hover:text-green-900"
                          title="Apri bando ufficiale"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      <button
                        onClick={() => handleTemplateSelect(bando)}
                        className="text-purple-600 hover:text-purple-900"
                        title="Gestisci template documenti"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteBando(bando.id)}
                        className="text-red-600 hover:text-red-900"
                        title="Elimina bando"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {bandiFiltrati.length === 0 && (
          <div className="text-center py-12">
            <Building className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Nessun bando trovato</h3>
            <p className="mt-1 text-sm text-gray-500">
              Non ci sono bandi che corrispondono ai filtri selezionati.
            </p>
          </div>
        )}
      </div>

      {/* Modal dettagli bando */}
      {selectedBando && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-7xl w-full max-h-[95vh] overflow-hidden m-4">
            <div className="flex flex-col h-full">
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{selectedBando.nome}</h2>
                    <p className="text-gray-600">{selectedBando.codice_bando}</p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedBando(null)
                      setActiveTab('info')
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>

                {/* Tabs */}
                <div className="flex space-x-1">
                  <button
                    onClick={() => setActiveTab('info')}
                    className={`px-4 py-2 text-sm font-medium rounded-lg ${
                      activeTab === 'info'
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4" />
                      Informazioni
                    </div>
                  </button>
                  <button
                    onClick={() => setActiveTab('documenti')}
                    className={`px-4 py-2 text-sm font-medium rounded-lg ${
                      activeTab === 'documenti'
                        ? 'bg-green-100 text-green-700'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Documenti
                    </div>
                  </button>
                  <button
                    onClick={() => setActiveTab('template')}
                    className={`px-4 py-2 text-sm font-medium rounded-lg ${
                      activeTab === 'template'
                        ? 'bg-purple-100 text-purple-700'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Settings className="w-4 h-4" />
                      Editor Template
                    </div>
                  </button>
                </div>
              </div>

              {/* Contenuto Tab */}
              <div className="flex-1 overflow-hidden">
                {activeTab === 'info' ? (
                  <div className="p-6 overflow-y-auto h-full">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">Informazioni Generali</h3>
                          <div className="space-y-2 text-sm">
                            <div><span className="font-medium">Ente:</span> {selectedBando.ente_erogatore}</div>
                            <div><span className="font-medium">Tipologia:</span> {selectedBando.tipologia_bando}</div>
                            <div><span className="font-medium">Contributo Max:</span> {formatCurrency(selectedBando.contributo_massimo)}</div>
                            <div><span className="font-medium">Budget Totale:</span> {formatCurrency(selectedBando.budget_totale)}</div>
                            <div><span className="font-medium">% Contributo:</span> {selectedBando.percentuale_contributo}%</div>
                          </div>
                        </div>

                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">Scadenze</h3>
                          <div className="space-y-2 text-sm">
                            <div><span className="font-medium">Pubblicazione:</span> {formatDate(selectedBando.data_pubblicazione)}</div>
                            <div><span className="font-medium">Apertura:</span> {formatDate(selectedBando.data_apertura_presentazione)}</div>
                            <div><span className="font-medium">Chiusura:</span> {formatDate(selectedBando.data_chiusura_presentazione)}</div>
                            <div><span className="font-medium">Valutazione:</span> {selectedBando.tempo_valutazione_giorni} giorni</div>
                            <div><span className="font-medium">Tipo Valutazione:</span> {selectedBando.tipo_valutazione}</div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">Criteri di Ammissibilità</h3>
                          <div className="space-y-2 text-sm">
                            <div>
                              <span className="font-medium">Settori:</span>
                              <div className="mt-1">
                                {selectedBando.settori_ammessi?.map(settore => (
                                  <span key={settore} className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded mr-1 mb-1">
                                    {settore}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div>
                              <span className="font-medium">Dimensioni Aziendali:</span>
                              <div className="mt-1">
                                {selectedBando.dimensioni_aziendali_ammesse?.map(dim => (
                                  <span key={dim} className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded mr-1 mb-1">
                                    {dim}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div><span className="font-medium">Area Geografica:</span> {selectedBando.localizzazione_geografica}</div>
                          </div>
                        </div>

                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">Contatti e Documenti</h3>
                          <div className="space-y-2 text-sm">
                            <div><span className="font-medium">Referente:</span> {selectedBando.referente_bando}</div>
                            <div><span className="font-medium">Email:</span> {selectedBando.email_referente}</div>
                            <div><span className="font-medium">Documenti caricati:</span> {selectedBando.documenti_caricati}</div>
                            {selectedBando.link_bando_ufficiale && (
                              <div>
                                <a
                                  href={selectedBando.link_bando_ufficiale}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  Bando Ufficiale
                                </a>
                              </div>
                            )}
                          </div>
                        </div>

                        {selectedBando.note_interne && (
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Note Interne</h3>
                            <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                              {selectedBando.note_interne}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {selectedBando.descrizione && (
                      <div className="mt-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Descrizione</h3>
                        <p className="text-sm text-gray-600 bg-gray-50 p-4 rounded">
                          {selectedBando.descrizione}
                        </p>
                      </div>
                    )}
                  </div>
                ) : activeTab === 'documenti' ? (
                  <div className="p-6 overflow-y-auto h-full">
                    <BandoDocumentsTab
                      bandoId={selectedBando.id}
                      onTemplateSelect={(template) => {
                        // Non far nulla per ora, solo visualizzazione
                      }}
                    />
                  </div>
                ) : (
                  <div className="h-full p-6">
                    <DocumentTemplateEditor
                      bandoId={selectedBando.id}
                      onSave={saveDocumentTemplate}
                      existingTemplate={JSON.parse(localStorage.getItem(`template_${selectedBando.id}`) || 'null')}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Form Nuovo Bando */}
      {showNewBandoModal && (
        <BandoForm
          onClose={() => setShowNewBandoModal(false)}
          onBandoCreated={handleBandoCreated}
        />
      )}

      {/* Form Modifica Bando */}
      {showEditBandoModal && editingBando && (
        <BandoForm
          bando={editingBando}
          onClose={() => {
            setShowEditBandoModal(false)
            setEditingBando(null)
          }}
          onBandoCreated={handleBandoCreated}
        />
      )}

      {/* Form Creazione Progetto */}
      {showProgettoModal && progettoFromBando && (
        <ProgettoForm
          bando={progettoFromBando}
          onClose={() => {
            setShowProgettoModal(false)
            setProgettoFromBando(null)
          }}
          onProgettoCreated={handleProgettoCreated}
        />
      )}

      {/* Modal Conferma Eliminazione */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Conferma eliminazione
                  </h3>
                  <p className="text-gray-600">
                    {bandoToDelete
                      ? "Sei sicuro di voler eliminare questo bando?"
                      : `Sei sicuro di voler eliminare ${selectedBandiForDelete.size} bandi selezionati?`
                    }
                  </p>
                </div>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-yellow-800">
                  <strong>Attenzione:</strong> Questa operazione è irreversibile e eliminerà automaticamente TUTTI i progetti collegati ai bandi selezionati e le relative scadenze.
                </p>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false)
                    setBandoToDelete(null)
                  }}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  disabled={deleting}
                >
                  Annulla
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={deleting}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {deleting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Eliminando...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Elimina definitivamente
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}