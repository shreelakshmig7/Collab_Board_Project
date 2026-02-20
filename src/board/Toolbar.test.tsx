import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Toolbar from './Toolbar'
import type { BoardObject } from '../types/board'

const defaultProps = {
  activeTool: null,
  onToolChange: () => {},
  connectorStyle: 'arrow' as const,
  onConnectorStyleChange: () => {},
  selectedIds: [] as string[],
  selectedObject: null as BoardObject | null,
  selectedColorableId: null as string | null,
  onColorChange: () => {},
  onResize: () => {},
  onDuplicate: () => {},
  onDelete: () => {},
}

describe('Toolbar', () => {
  it('renders View only when isViewOnly is true', () => {
    render(<Toolbar {...defaultProps} isViewOnly={true} />)
    expect(screen.getByText('View only')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Rename/i })).not.toBeInTheDocument()
  })

  it('renders full toolbar when isViewOnly is false', () => {
    render(<Toolbar {...defaultProps} isViewOnly={false} />)
    expect(screen.queryByText('View only')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Select/i })).toBeInTheDocument()
  })
})
