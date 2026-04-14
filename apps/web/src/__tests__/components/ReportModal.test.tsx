import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { apiPost } = vi.hoisted(() => ({ apiPost: vi.fn() }))
vi.mock('../../lib/api', () => ({ api: { post: apiPost } }))

import { ReportModal } from '../../components/ReportModal'

describe('ReportModal', () => {
  let onClose: ReturnType<typeof vi.fn>

  beforeEach(() => {
    apiPost.mockReset()
    onClose = vi.fn()
  })

  it('renders the target username', () => {
    render(<ReportModal targetUserId="u1" targetUsername="Alice" onClose={onClose} />)
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText(/Report Player/i)).toBeInTheDocument()
  })

  it('renders all six report reasons', () => {
    render(<ReportModal targetUserId="u1" targetUsername="Alice" onClose={onClose} />)
    for (const label of [
      /Cheating/i,
      /Harassment/i,
      /Hate Speech/i,
      /Inappropriate Name/i,
      /Spam/i,
      /Other/i,
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it('Submit Report button is disabled until a reason is chosen', () => {
    render(<ReportModal targetUserId="u1" targetUsername="Alice" onClose={onClose} />)
    const submit = screen.getByRole('button', { name: /Submit Report/i })
    expect(submit).toBeDisabled()
    fireEvent.click(screen.getByText(/Cheating/i))
    expect(submit).not.toBeDisabled()
  })

  it('close button ("×") calls onClose', () => {
    render(<ReportModal targetUserId="u1" targetUsername="Alice" onClose={onClose} />)
    fireEvent.click(screen.getByText('×'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Cancel button calls onClose', () => {
    render(<ReportModal targetUserId="u1" targetUsername="Alice" onClose={onClose} />)
    fireEvent.click(screen.getByText(/Cancel/i))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('clicking the backdrop calls onClose', () => {
    const { container } = render(
      <ReportModal targetUserId="u1" targetUsername="Alice" onClose={onClose} />,
    )
    fireEvent.click(container.firstChild as HTMLElement)
    expect(onClose).toHaveBeenCalled()
  })

  it('clicking inside the dialog does NOT close', () => {
    render(<ReportModal targetUserId="u1" targetUsername="Alice" onClose={onClose} />)
    fireEvent.click(screen.getByText(/Report Player/i))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('caps the details field at 500 characters', () => {
    render(<ReportModal targetUserId="u1" targetUsername="Alice" onClose={onClose} />)
    const textarea = screen.getByPlaceholderText(/Describe what happened/i) as HTMLTextAreaElement
    const long = 'x'.repeat(600)
    fireEvent.change(textarea, { target: { value: long } })
    expect(textarea.value.length).toBe(500)
    expect(screen.getByText('500/500')).toBeInTheDocument()
  })

  it('submitting posts to /users/:id/report and shows the success card', async () => {
    apiPost.mockResolvedValueOnce({})
    render(<ReportModal targetUserId="u42" targetUsername="Bob" onClose={onClose} />)
    fireEvent.click(screen.getByText(/Harassment/i))
    fireEvent.change(screen.getByPlaceholderText(/Describe what happened/i), {
      target: { value: 'they were rude' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Submit Report/i }))
    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith('/users/u42/report', {
        reason: 'harassment',
        details: 'they were rude',
      })
    })
    expect(await screen.findByText(/Report Submitted/i)).toBeInTheDocument()
  })

  it('omits empty details from the payload', async () => {
    apiPost.mockResolvedValueOnce({})
    render(<ReportModal targetUserId="u1" targetUsername="Alice" onClose={onClose} />)
    fireEvent.click(screen.getByText(/Spam/i))
    fireEvent.click(screen.getByRole('button', { name: /Submit Report/i }))
    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith('/users/u1/report', { reason: 'spam', details: undefined })
    })
  })

  it('shows the API error message on failure', async () => {
    apiPost.mockRejectedValueOnce(new Error('too many reports'))
    render(<ReportModal targetUserId="u1" targetUsername="Alice" onClose={onClose} />)
    fireEvent.click(screen.getByText(/Cheating/i))
    fireEvent.click(screen.getByRole('button', { name: /Submit Report/i }))
    expect(await screen.findByText(/too many reports/i)).toBeInTheDocument()
  })

  it('Done button in the success state calls onClose', async () => {
    apiPost.mockResolvedValueOnce({})
    render(<ReportModal targetUserId="u1" targetUsername="Alice" onClose={onClose} />)
    fireEvent.click(screen.getByText(/Cheating/i))
    fireEvent.click(screen.getByRole('button', { name: /Submit Report/i }))
    const done = await screen.findByText(/^Done$/)
    fireEvent.click(done)
    expect(onClose).toHaveBeenCalled()
  })
})
