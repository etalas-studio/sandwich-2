import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DocumentCard from './DocumentCard'
import { getDocument } from '../api/documents'

vi.mock('../api/documents', () => ({
  getDocument: vi.fn(),
  documentExportUrl: vi.fn((id: string, format: string) => `/api/documents/${id}/export?format=${format}`),
}))

const mockedGetDocument = getDocument as unknown as ReturnType<typeof vi.fn>

describe('DocumentCard', () => {
  beforeEach(() => {
    mockedGetDocument.mockReset()
  })

  it('renders title/type/version and calls onClick', async () => {
    mockedGetDocument.mockResolvedValue({
      id: 'doc1',
      userId: 'u1',
      type: 'prd',
      title: 'My PRD',
      currentVersionId: 'v2',
      previewUrl: null,
      createdAt: '',
      updatedAt: '',
      latestVersion: { id: 'v2', documentId: 'doc1', versionNo: 2, content: '# Hi', promptUsed: null, createdAt: '' },
      versions: [],
    })
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<DocumentCard documentId="doc1" onClick={onClick} />)

    expect(await screen.findByText('My PRD')).toBeInTheDocument()
    expect(screen.getByText('PRD')).toBeInTheDocument()
    expect(screen.getByText('v2')).toBeInTheDocument()

    await user.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('shows initial metadata before the fetch resolves', () => {
    mockedGetDocument.mockReturnValue(new Promise(() => {}))
    render(
      <DocumentCard
        documentId="doc1"
        initial={{ type: 'specs', title: 'Specs Draft', versionNo: 1 }}
        onClick={vi.fn()}
      />,
    )

    expect(screen.getByText('Specs Draft')).toBeInTheDocument()
    expect(screen.getByText('Specs')).toBeInTheDocument()
  })
})
