// Stub file — minimal type exports to satisfy importers

export type NotebookCellType = 'code' | 'markdown' | 'raw'

export type NotebookOutputImage = {
  image_data: string
  media_type: string
}

export type NotebookCellSourceOutput = {
  output_type: string
  text?: string
  image?: NotebookOutputImage
}

export type NotebookCellSource = {
  cellType: NotebookCellType
  source: string
  execution_count?: number
  cell_id: string
  language?: string
  outputs?: NotebookCellSourceOutput[]
}

export type NotebookCellOutput = {
  output_type: string
  text?: string | string[]
  data?: Record<string, any>
  ename?: string
  evalue?: string
  traceback?: string[]
}

export type NotebookCell = {
  id?: string
  cell_type: NotebookCellType
  source: string | string[]
  execution_count?: number | null
  outputs?: NotebookCellOutput[]
  metadata?: Record<string, unknown>
}

export type NotebookContent = {
  metadata: {
    language_info?: {
      name: string
    }
  }
  nbformat: number
  nbformat_minor: number
  cells: NotebookCell[]
}
