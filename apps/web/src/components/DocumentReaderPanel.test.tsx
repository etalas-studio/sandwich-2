import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import DocumentReaderPanel from './DocumentReaderPanel'
import { getDocument, documentExportUrl } from '../api/documents'

vi.mock('../api/documents', () => ({
  getDocument: vi.fn(),
  documentExportUrl: vi.fn((id: string, format: string) => `/api/documents/${id}/export?format=${format}`),
}))

const mockedGetDocument = getDocument as unknown as ReturnType<typeof vi.fn>

describe('DocumentReaderPanel', () => {
  beforeEach(() => {
    mockedGetDocument.mockReset()
    vi.mocked(documentExportUrl).mockClear()
  })

  it('renders markdown content for a prd', async () => {
    mockedGetDocument.mockResolvedValue({
      id: 'doc1',
      projectId: 'p1',
      conversationId: 'c1',
      type: 'prd',
      title: 'PRD One',
      relativePath: 'prd.md',
      lastCommitSha: 'abc1234',
      previewUrl: null,
      createdAt: '',
      updatedAt: '',
      content: '# Hello',
    })

    render(<DocumentReaderPanel documentId="doc1" onClose={vi.fn()} />)

    expect(await screen.findByText('PRD One')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Hello' })).toBeInTheDocument()
    expect(documentExportUrl).toHaveBeenCalledWith('doc1', 'md')
  })

  it('renders an iframe preview for a prototype', async () => {
    mockedGetDocument.mockResolvedValue({
      id: 'doc2',
      projectId: 'p1',
      conversationId: 'c1',
      type: 'prototype',
      title: 'Proto',
      relativePath: 'prototype/index.html',
      lastCommitSha: 'def5678',
      previewUrl: '/p/doc2/',
      createdAt: '',
      updatedAt: '',
      content: null,
    })

    render(<DocumentReaderPanel documentId="doc2" onClose={vi.fn()} />)

    const iframe = await screen.findByTitle('Proto')
    expect(iframe.tagName).toBe('IFRAME')
    expect(iframe.getAttribute('src')).toContain('/p/doc2')
  })

  it('renders nothing when documentId is null', () => {
    const { container } = render(<DocumentReaderPanel documentId={null} onClose={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })
})
