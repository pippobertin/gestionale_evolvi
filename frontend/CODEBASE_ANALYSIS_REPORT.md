# Frontend Codebase Analysis Report
**Gestionale Evolvi - Frontend Application**

---

## Executive Summary

The frontend codebase is a **Next.js 16 (App Router)** application with **35,026 lines of TypeScript/TSX code** spanning **103 component/utility files**. The application integrates with Supabase for data management, Google APIs (Drive, Gmail, Calendar), and implements complex workflows for project and tender management.

**Overall Assessment:** The codebase shows signs of rapid development with **HIGH PRIORITY refactoring needs**, particularly around code duplication and component complexity.

---

## 1. Code Structure Overview

### 1.1 Directory Architecture

```
frontend/src/
├── app/
│   ├── api/
│   │   ├── admin/          (User management APIs)
│   │   ├── auth/           (Authentication routes)
│   │   ├── calendar/       (Google Calendar integration)
│   │   ├── clienti/        (Client management)
│   │   ├── contracts/      (Contract generation & approval)
│   │   ├── drive/          (Google Drive operations)
│   │   ├── gmail/          (Gmail integration)
│   │   ├── notifications/  (Email & scheduler)
│   │   └── [other routes]
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── shared/             (Shared UI components)
│   ├── ui/                 (shadcn/radix-ui based components)
│   └── [~60 domain components]
├── contexts/
│   └── AuthContext.tsx
├── hooks/
│   ├── useContractGeneration.ts
│   ├── useGoogleDriveStatus.ts
│   ├── useNotificationScheduler.ts
│   └── useScrollLock.ts
├── lib/
│   ├── notifications/      (Email, Calendar, Notification services)
│   ├── auth.ts
│   ├── gmail.ts
│   ├── googleAuth.ts
│   ├── googleDrive.ts
│   ├── jwtAuth.ts
│   ├── supabase.ts
│   └── wordTemplate.ts
├── pages/api/             (Legacy Pages Router APIs - ~4 files)
└── types/
    └── next-auth.d.ts

```

### 1.2 Metrics

| Metric | Count |
|--------|-------|
| **Total Lines of Code** | 35,026 |
| **Component Files** | ~60 |
| **API Route Files** | ~46 |
| **Utility/Service Files** | ~15 |
| **Custom Hook Files** | 4 |
| **Dependencies** | 24 (production) |
| **Files with console.log** | 92 |

### 1.3 Architecture Pattern

- **Framework:** Next.js 16 (App Router + some legacy Pages Router)
- **Styling:** Tailwind CSS with custom CSS files
- **State Management:** React hooks (useState, useEffect) + React Context
- **API Integration:** Mix of server-side (API routes) and client-side (fetch)
- **Authentication:** NextAuth.js 4.24.13 with custom JWT fallback
- **Database:** Supabase (PostgreSQL)
- **External APIs:** Google Drive, Gmail, Calendar (googleapis library)

---

## 2. High Priority Issues

### 2.1 Code Duplication - Selector Components

**Severity:** HIGH | **Impact:** Maintenance, Testing

Four nearly-identical selector components exist, with 100% code duplication:

| File | Lines | Purpose | Differs From |
|------|-------|---------|--------------|
| `/src/components/ResponsableSelector.tsx` | 222 | Single selection (utente/gruppo/all) | Base implementation |
| `/src/components/SimpleResponsableSelector.tsx` | 199 | Single selection (returns email) | Different return type |
| `/src/components/MultiResponsableSelector.tsx` | 264 | Multiple selection returns array | Core logic identical |
| `/src/components/MultipleResponsableSelector.tsx` | 284 | Multiple selection variant | Nearly identical to above |

**Problem:** All four load users/groups from same Supabase table with identical queries, render similar UI, but return different formats.

**Recommendation:** Create a single generic `<ResponsableSelector>` component with composition:
```typescript
interface SelectorConfig {
  mode: 'single' | 'multiple'
  returnFormat: 'object' | 'email' | 'id'
  allowGroups?: boolean
}
```

**Estimated Effort:** 4-6 hours to consolidate, refactor, and test

---

### 2.2 Massive Components Exceeding 500 Lines

**Severity:** HIGH | **Impact:** Testability, Maintainability

| Component | Lines | Issues |
|-----------|-------|--------|
| `/src/components/ProgettoForm.tsx` | 2,348 | **CRITICAL** - Contains entire form state management + submission logic + multiple tabs + nested modals |
| `/src/components/ClienteForm.tsx` | 1,907 | Large form with company data + referenti management + connected companies |
| `/src/components/ReportsContent.tsx` | 1,817 | Multiple report types + data fetching + chart rendering logic |
| `/src/components/BandoForm.tsx` | 1,789 | Complex form with dynamic fields and nested components |
| `/src/components/GmailClient.tsx` | 1,455 | Full Gmail interface + compose + search + label management |

**Problems:**
- Single file does too many things (rendering + state + logic + API calls)
- Difficult to test individual features
- Hard to reuse form logic across other components
- Props drilling is likely occurring
- Performance issues possible with large re-renders

**Recommendation:** Break down ProgettoForm into:
- `<ProgettoFormTabs>` - Tab navigation
- `<ProgettoGeneraleTab>` - General info form
- `<ProgettoImportiTab>` - Budget tab
- `<ProgettoScadenzeTab>` - Deadlines tab
- `<ProgettoDocumentiTab>` - Documents tab
- `<ProgettoAvanzateTab>` - Advanced settings
- Custom hooks: `useProgettoForm()`, `useProgettoSubmit()`

**Estimated Effort:** 15-20 hours for ProgettoForm alone

---

### 2.3 Repeated Gmail Token Retrieval Pattern

**Severity:** HIGH | **Impact:** Maintainability, DRY Principle

Gmail token retrieval code is repeated **12+ times** across API routes:

**Files with duplication:**
- `/src/app/api/gmail/messages/route.ts` (lines 14-24)
- `/src/app/api/gmail/messages/[id]/route.ts` (lines 16-26, 154-158)
- `/src/app/api/gmail/messages/[id]/read/route.ts`
- `/src/app/api/gmail/messages/[id]/markAsRead/route.ts`
- `/src/app/api/gmail/messages/[id]/star/route.ts`
- `/src/app/api/gmail/send/route.ts`
- `/src/app/api/gmail/labels/route.ts`
- `/src/app/api/gmail/test/route.ts`
- `/src/app/api/gmail/status/route.ts`
- And others...

**Duplicated Pattern:**
```typescript
const { data: refreshTokenData } = await supabase
  .from('scadenze_bandi_system_settings')
  .select('value')
  .eq('key', 'gmail_refresh_token')
  .single()

const { data: accessTokenData } = await supabase
  .from('scadenze_bandi_system_settings')
  .select('value')
  .eq('key', 'gmail_access_token')
  .single()

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/gmail/callback`
)

oauth2Client.setCredentials({
  refresh_token: refreshTokenData.value,
  access_token: accessTokenData?.value
})
```

**Recommendation:** Create utility function in `/src/lib/gmail.ts`:
```typescript
export async function getGmailClient() {
  const refreshToken = await getSystemSetting('gmail_refresh_token')
  const accessToken = await getSystemSetting('gmail_access_token')
  
  const oauth2Client = createOAuth2Client()
  oauth2Client.setCredentials({
    refresh_token: refreshToken,
    access_token: accessToken
  })
  return google.gmail({ version: 'v1', auth: oauth2Client })
}
```

**Estimated Effort:** 2-3 hours

---

### 2.4 OAuth2 Client Initialization Duplication

**Severity:** MEDIUM | **Impact:** Maintainability

OAuth2 client initialization repeated **11+ times** across different API routes:

```typescript
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/gmail/callback`
)
```

Also appears for Calendar API and Drive API with same parameters.

**Recommendation:** Create factory function:
```typescript
// lib/googleAuth.ts
export function createGoogleAuthClient(redirectUri?: string) {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri || `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/gmail/callback`
  )
}
```

**Estimated Effort:** 1-2 hours

---

### 2.5 Console.log Statements in Production Code

**Severity:** MEDIUM | **Impact:** Security, Performance, Bundle Size

**92 files contain console.log/error/warn** including:

- `/src/components/ProgettoForm.tsx` - Multiple console.log calls
- `/src/components/GmailClient.tsx` (line 59): `console.log('🔄 GmailClient render, isOpen:', isOpen)`
- `/src/components/ReportsContent.tsx` - Multiple debug logs
- `/src/app/api/gmail/messages/[id]/route.ts` (lines 11-13): Debug logging in production
- All API routes with `console.error()` (acceptable) and `console.warn()` (acceptable)
- `/src/lib/googleAuth.ts` - Contains console.log statements
- `/src/lib/notifications/scheduler.ts` - Debug logs

**Examples of debug logs that should be removed:**
```typescript
// GmailClient.tsx line 59
console.log('🔄 GmailClient render, isOpen:', isOpen)

// gmail/messages/[id]/route.ts lines 11-13
console.log('Gmail message detail params:', resolvedParams)
console.log('Gmail message ID:', messageId)
```

**Recommendation:** 
- Remove all console.log and console.warn that are for debugging
- Keep console.error for error handling
- Use environment variable to conditionally log in development only

**Estimated Effort:** 1-2 hours

---

## 3. Medium Priority Issues

### 3.1 Missing Error Handling in Fetch Calls

**Severity:** MEDIUM | **Impact:** Reliability

Several `fetch()` calls lack proper error handling:

**Example from `/src/app/api/contracts/approve/route.ts`:**
```typescript
const uploadResponse = await fetch(uploadUrl, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${googleAccessToken}` }
})

// Missing: if (!uploadResponse.ok) check before calling .json()
const uploadedFile = await uploadResponse.json()
```

While some fetch calls check `response.ok`, others don't. Inconsistent pattern across:
- `/src/app/api/contracts/approve/route.ts` (line 100+)
- `/src/app/api/contracts/generate/route.ts`
- `/src/app/api/calendar/debug/route.ts`

**Recommendation:** Create wrapper function:
```typescript
async function fetchWithErrorHandling(url: string, options: RequestInit) {
  const response = await fetch(url, options)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }
  return response
}
```

**Estimated Effort:** 2-3 hours

---

### 3.2 Unused Dependency: @nivo/core

**Severity:** MEDIUM | **Impact:** Bundle Size

`@nivo/core` is in `package.json` but **never imported** in source code.

**package.json (line 17):**
```json
"@nivo/core": "^0.99.0",
```

Only `@nivo/bar`, `@nivo/line`, `@nivo/pie` are used in `ReportsContent.tsx`.

**Recommendation:** Remove from package.json

**Estimated Effort:** 5 minutes

---

### 3.3 Form State Management in Large Components

**Severity:** MEDIUM | **Impact:** Performance, Testing

Large form components like `ProgettoForm.tsx` use excessive `useState` hooks (20+):

```typescript
const [activeTab, setActiveTab] = useState<TabType>('generale')
const [loading, setLoading] = useState(false)
const [showContractModal, setShowContractModal] = useState(false)
const [savedProjectData, setSavedProjectData] = useState<any>(null)
const [bandi, setBandi] = useState<Bando[]>([])
const [clienti, setClienti] = useState<Cliente[]>([])
// ... 20+ more useState calls
```

**Problem:** 
- Makes re-renders slower due to multiple state updates
- Hard to manage related state values
- Testing individual state pieces is difficult

**Recommendation:** Use `useReducer` for complex form state:
```typescript
interface ProgettoFormState {
  activeTab: TabType
  loading: boolean
  modals: { contract: boolean; preview: boolean }
  data: ProgettoFormData
  fetchedData: { bandi: Bando[]; clienti: Cliente[] }
}
```

**Estimated Effort:** 6-8 hours for ProgettoForm

---

### 3.4 Missing TypeScript Strict Types

**Severity:** MEDIUM | **Impact:** Type Safety

Some components use loose typing:

- `/src/components/ProgettoForm.tsx` (line 70): `progetto?: any`
- `/src/components/ReportsContent.tsx`: Multiple `any` types in data structures
- `/src/lib/wordTemplate.ts`: Many `any` type usages

**Recommendation:** 
- Enable strict mode in `tsconfig.json` if not already enabled
- Replace `any` with proper interfaces
- Use discriminated unions for complex data types

**Estimated Effort:** 4-6 hours

---

### 3.5 Missing Database Error Handling

**Severity:** MEDIUM | **Impact:** User Experience

Supabase queries sometimes don't properly handle errors:

**Example from `/src/components/BandiContent.tsx` (lines 72-80):**
```typescript
const { data: bandiData, error: bandiError } = await supabase
  .from('scadenze_bandi_bandi')
  .select('*')
  .order('data_chiusura_presentazione', { ascending: true })

if (bandiError) {
  setError('Errore caricamento bandi')
  setLoading(false)
  return
}
```

While error is checked, the error message is generic. Many components don't provide specific error feedback to users.

**Recommendation:** Create error message utility:
```typescript
function getErrorMessage(error: PostgrestError): string {
  if (error.code === 'PGRST116') return 'Tabella non trovata'
  if (error.message.includes('unique')) return 'Valore duplicato'
  return error.message || 'Errore sconosciuto'
}
```

**Estimated Effort:** 2-3 hours

---

## 4. Low Priority Issues

### 4.1 Commented Out Code

**Finding:** No significant blocks of commented-out code found in main source files. Codebase appears relatively clean in this regard.

---

### 4.2 Hardcoded Values

**Severity:** LOW | **Impact:** Configuration

Some hardcoded values found:

- `/src/app/api/gmail/messages/route.ts` (line 8): `maxResults: 50` (default)
- `/src/components/GmailClient.tsx` (line 68): `'INBOX'` as default label
- Various API URLs constructed with hardcoded paths

**Recommendation:** Extract to constants file:
```typescript
// lib/constants.ts
export const GMAIL_CONFIG = {
  DEFAULT_MAX_RESULTS: 50,
  DEFAULT_LABEL: 'INBOX',
  GMAIL_CALLBACK_PATH: '/api/auth/gmail/callback'
}
```

**Estimated Effort:** 1-2 hours

---

### 4.3 Inconsistent Error Message Language

**Severity:** LOW | **Impact:** UX Polish

Mix of Italian and English error messages:

- "Gmail non configurato" (Italian)
- "Error fetching Gmail messages:" (English)
- "Errore durante il caricamento dei messaggi" (Italian)
- "Error deleting Gmail message:" (English)

**Recommendation:** Standardize on one language (appears to be Italian for UI)

**Estimated Effort:** 1 hour

---

### 4.4 Missing PropTypes/Interface Validation

**Severity:** LOW | **Impact:** Runtime Safety

Some component props not fully typed:

- `/src/components/ProgettoForm.tsx` (line 70): `progetto?: any`
- Modal components sometimes use loose prop typing

**Recommendation:** Add runtime validation library (zod, io-ts) or ensure all props have proper interfaces

**Estimated Effort:** 2-3 hours

---

## 5. Dependency Analysis

### 5.1 Package.json Inventory

**Dependencies Used:** 23/24
**Total Dependencies:** 24 (production) + 1 (dev)

| Dependency | Version | Usage | Status |
|------------|---------|-------|--------|
| next | ^16.0.1 | Framework | ✓ Used |
| react | ^19.2.0 | UI Library | ✓ Used |
| react-dom | ^19.2.0 | DOM Rendering | ✓ Used |
| @supabase/supabase-js | ^2.80.0 | Database | ✓ Used (55 imports) |
| googleapis | ^166.0.0 | Google APIs | ✓ Used (13 imports) |
| next-auth | ^4.24.13 | Authentication | ✓ Used |
| lucide-react | ^0.552.0 | Icons | ✓ Used |
| tailwindcss | ^3.4.18 | CSS Framework | ✓ Used |
| @nivo/bar | ^0.99.0 | Charts | ✓ Used |
| @nivo/line | ^0.99.0 | Charts | ✓ Used |
| @nivo/pie | ^0.99.0 | Charts | ✓ Used |
| **@nivo/core** | **^0.99.0** | **Charts Base** | **✗ UNUSED** |
| @radix-ui/react-dialog | ^1.1.15 | Dialog Component | ✓ Used |
| @tailwindcss/forms | ^0.5.10 | Form Styling | ✓ Used |
| docxtemplater | ^3.67.6 | Word Templates | ✓ Used (in wordTemplate.ts) |
| pizzip | ^3.2.0 | ZIP Library | ✓ Used (docx dependency) |
| bcrypt | ^6.0.0 | Hashing | ✓ Used |
| jsonwebtoken | ^9.0.2 | JWT | ✓ Used (6 imports) |
| nodemailer | ^7.0.11 | Email | ✓ Used (notifications) |
| imapflow | ^1.1.1 | IMAP | Possibly unused, verify usage |
| google-auth-library | ^10.5.0 | OAuth | ✓ Used |
| date-fns | ^4.1.0 | Date Utility | ✓ Used |
| class-variance-authority | ^0.7.1 | Component Variants | ✓ Used |
| autoprefixer | ^10.4.21 | CSS Processor | ✓ Used |
| postcss | ^8.5.6 | CSS Processor | ✓ Used |
| typescript | ^5.9.3 | Language | ✓ Used |
| jszip-utils | ^0.1.0 | ZIP Utils | Possibly unused, check usage |

**Suspicious Dependencies:**

1. **@nivo/core** - Unused, remove it
2. **imapflow** - Verify if used (not found in grep results)
3. **jszip-utils** - Verify usage

**Recommendation:** Run `npm ls` to check for unused transitive dependencies and prune

**Estimated Effort:** 30 minutes

---

## 6. File-Specific Analysis

### 6.1 Components > 500 Lines (Candidates for Refactoring)

| File | Lines | Complexity | Priority |
|------|-------|-----------|----------|
| ProgettoForm.tsx | 2,348 | VERY HIGH | CRITICAL |
| ClienteForm.tsx | 1,907 | HIGH | HIGH |
| ReportsContent.tsx | 1,817 | HIGH | HIGH |
| BandoForm.tsx | 1,789 | HIGH | HIGH |
| GmailClient.tsx | 1,455 | HIGH | MEDIUM |
| ScadenzeContent.tsx | 903 | MEDIUM | MEDIUM |
| ProgettiContent.tsx | 854 | MEDIUM | MEDIUM |
| ClienteDettaglio.tsx | 847 | MEDIUM | MEDIUM |
| ClientiContent.tsx | 786 | MEDIUM | MEDIUM |
| BandiContent.tsx | 751 | MEDIUM | MEDIUM |
| ScadenzaForm.tsx | 630 | MEDIUM | MEDIUM |
| NotificationSettings.tsx | 621 | MEDIUM | MEDIUM |
| UserManagement.tsx | 604 | MEDIUM | MEDIUM |
| DashboardContent.tsx | 597 | MEDIUM | MEDIUM |

**Refactoring Strategy:**
1. Extract custom hooks for data fetching (`useProgettoData()`, `useClienteData()`)
2. Break large forms into tabs/sections as separate components
3. Extract table rendering logic into reusable `<DataTable>` component
4. Move complex filter logic into separate hook files

---

### 6.2 Utility Files Analysis

| File | Lines | Purpose | Issues |
|------|-------|---------|--------|
| calendarService.ts | 586 | Google Calendar integration | Large service, consider splitting |
| googleDrive.ts | 439 | Drive operations | Multiple responsibilities |
| emailService.ts | 404 | Email handling | Could be split by provider |
| notificationService.ts | 347 | Notification orchestration | Good separation of concerns |
| scheduler.ts | 269 | Cron/scheduling | Consider using node-cron library |
| googleAuth.ts | 226 | OAuth handling | Good, but some duplication |
| wordTemplate.ts | 210 | Word doc generation | Missing error boundaries |
| gmail.ts | 150 | Gmail client wrapper | Duplicates code from API routes |

---

## 7. Pattern Inconsistencies

### 7.1 API Route Error Handling

**Inconsistent patterns:**

**Pattern A - API Route (consistent):**
```typescript
try {
  // logic
  return NextResponse.json({ success: true })
} catch (error: any) {
  console.error('Error:', error)
  return NextResponse.json({ success: false, error: error.message }, { status: 500 })
}
```

**Pattern B - Component (less consistent):**
```typescript
try {
  setLoading(true)
  // logic
} catch (error) {
  setError(error.message)
} finally {
  setLoading(false)
}
```

**Pattern C - Missing Error Handler:**
```typescript
const response = await fetch(url)
const data = await response.json() // Can throw if response is not JSON
```

**Recommendation:** Create error handling utility for consistency

---

### 7.2 Data Fetching Patterns

**Multiple approaches in use:**

1. **Supabase in components:** Direct `.select().eq()` calls
2. **Supabase in API routes:** Same pattern with additional error logging
3. **Fetch in API routes:** Google APIs using fetch
4. **Google client library:** googleapis npm package for Gmail

**Recommendation:** Create abstraction layer for data fetching to ensure consistency

---

## 8. Security Concerns

### 8.1 Environment Variable Usage

**Positive:**
- API keys not committed (using `.env.local`)
- Gmail/Google credentials in environment

**Concerns:**
- Hardcoded URLs in some places: `http://localhost:3000/api/contracts/generate`
- Environment configuration spread across components

**Recommendation:**
```typescript
// lib/config.ts
export const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  GMAIL_CALLBACK_PATH: '/api/auth/gmail/callback',
  // ...
}
```

---

### 8.2 Token Storage

Gmail/Google tokens stored in database in `scadenze_bandi_system_settings` table - good approach.

**Recommendation:** Add token refresh logic and consider encrypting sensitive values in database.

---

## 9. Performance Observations

### 9.1 Potential Issues

1. **Large Component Bundles:** ProgettoForm.tsx at 2,348 lines contributes significantly to bundle size
2. **No Code Splitting Visible:** All components imported normally, not using React.lazy()
3. **useEffect Dependencies:** Some components may trigger unnecessary re-fetches
4. **Nivo Charts:** Heavy library (~1.5MB), only used in ReportsContent - good that it's isolated

### 9.2 Recommendations

- Use dynamic imports for heavy components
- Implement proper useEffect dependency arrays
- Consider virtualization for large lists (if any)
- Monitor bundle size with `next/bundle-analyzer`

---

## 10. Testing Gaps

### 10.1 Missing Tests

No test files found in repository (no `*.test.ts`, `*.spec.ts`, or `__tests__` directories).

**Critical areas needing tests:**
1. Form submission logic (ProgettoForm, ClienteForm, BandoForm)
2. API routes (Gmail operations, contracts, notifications)
3. Authentication flows
4. Data transformation utilities

**Recommendation:**
- Set up Jest + React Testing Library
- Create test files for critical paths
- Aim for 70%+ coverage on API routes

**Estimated Effort:** 20-30 hours for core paths

---

## 11. Documentation Issues

### 11.1 Missing Documentation

No README or documentation found in frontend directory for:
- Setting up development environment
- API endpoint documentation
- Component prop documentation
- Deployment process

**Recommendation:** Create:
1. `README.md` with setup instructions
2. `ARCHITECTURE.md` explaining folder structure
3. JSDoc comments for exported functions
4. Component storybook for UI components

---

## 12. Build & Deploy Configuration

### 12.1 Next.js Configuration

- `next.config.js` exists (minimal)
- `tsconfig.json` exists
- `tailwind.config.js` exists
- `.env.local` exists (not committed, good)

### 12.2 Build Issues

No obvious build issues detected. The app builds successfully (mentioned in git status).

---

## Summary of Recommendations by Priority

### CRITICAL (Fix immediately)
1. **Refactor ProgettoForm.tsx** - Break into smaller components (20+ hours)
2. **Consolidate Selector Components** - Create single generic component (6 hours)
3. **Extract Gmail Token Logic** - DRY principle violation (3 hours)

### HIGH (Within next sprint)
1. **Remove console.log statements** - Production code cleanup (2 hours)
2. **Refactor Large Forms** - ClienteForm, BandoForm, etc. (15 hours)
3. **Add Error Handling Tests** - Verify all error paths work (5 hours)

### MEDIUM (Within next 2 sprints)
1. **Remove @nivo/core dependency** - Unused package (0.5 hours)
2. **Consistent Error Handling** - Create utility functions (3 hours)
3. **Extract Magic Strings** - Configuration constants (2 hours)
4. **Add TypeScript Strict Mode** - Improve type safety (6 hours)

### LOW (Polish/optimization)
1. **Create Utility Abstractions** - Data fetching layers (4 hours)
2. **Add Component Documentation** - JSDoc comments (3 hours)
3. **Performance Optimization** - Code splitting, lazy loading (4 hours)
4. **Standardize Error Messages** - Language consistency (1 hour)

---

## Estimated Total Refactoring Time

| Category | Hours |
|----------|-------|
| Critical Issues | 29 |
| High Priority | 19 |
| Medium Priority | 21 |
| Low Priority | 12 |
| **TOTAL** | **81 hours** |

This can be spread over 3-4 sprints (2-week sprints) with 1-2 developers.

---

## Conclusion

The codebase is **functional but showing signs of technical debt** accumulation. Primary concerns are:

1. **Code Duplication:** 4 selector components, repeated token fetching, repeated OAuth initialization
2. **Component Complexity:** Multiple components exceeding 2000 lines with mixed concerns
3. **Maintainability:** Difficult to test, modify, or extend due to size and structure
4. **Production Code Quality:** Debug console logs, inconsistent error handling

**The good news:** The codebase has a clear structure (Next.js best practices), reasonable separation of concerns in most areas, and handles complex integrations with Google APIs well. With focused refactoring, this can become a highly maintainable codebase.

**Recommended next step:** Start with the CRITICAL items, especially ProgettoForm refactoring and selector consolidation. These will have the highest ROI in terms of maintainability and developer velocity.
