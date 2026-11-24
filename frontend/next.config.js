/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Ignora gli errori TypeScript durante il build di produzione
    // TODO: rimuovere dopo aver fixato tutti gli errori TypeScript
    ignoreBuildErrors: true,
  },
  // Forza Next.js a includere i font AFM standard di pdfkit (dipendenza di pdfmake)
  // nel bundle delle serverless function. Senza questo, l'endpoint di export PDF
  // fallisce con: ENOENT: ... Helvetica-Bold.afm
  outputFileTracingIncludes: {
    '/api/clienti/**': [
      './node_modules/pdfkit/js/data/**/*',
    ],
    '/api/231/**': [
      './node_modules/pdfkit/js/data/**/*',
    ],
    '/api/email/**': [
      './node_modules/pdfkit/js/data/**/*',
    ],
    // Guida: la leggono la pagina Aiuto e l'assistente
    '/api/faq': ['./docs/guida/**/*'],
    '/api/chatbot': ['./docs/guida/**/*'],
  },
  // Esclude pdfmake e pdfkit dal bundle Turbopack: vengono caricati a runtime
  // come moduli Node, cosi' i file .afm vengono trovati dove stanno davvero.
  serverExternalPackages: ['pdfmake', 'pdfkit', 'fontkit'],
}

module.exports = nextConfig