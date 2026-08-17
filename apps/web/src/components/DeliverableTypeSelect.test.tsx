import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DeliverableTypeSelect } from './DeliverableTypeSelect'

describe('DeliverableTypeSelect', () => {
  it('renders the Auto label for empty value', () => {
    render(<DeliverableTypeSelect value="" onChange={vi.fn()} />)
    expect(screen.getByRole('combobox')).toHaveTextContent('Auto')
  })

  it('renders the label for a selected deliverable', () => {
    render(<DeliverableTypeSelect value="prd" onChange={vi.fn()} />)
    expect(screen.getByRole('combobox')).toHaveTextContent('PRD')
  })

  it('emits the chosen value when an option is selected', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<DeliverableTypeSelect value="" onChange={onChange} />)

    await user.click(screen.getByRole('combobox'))
    await user.click(screen.getByRole('option', { name: 'PRD' }))

    expect(onChange).toHaveBeenCalledWith('prd')
  })
})
