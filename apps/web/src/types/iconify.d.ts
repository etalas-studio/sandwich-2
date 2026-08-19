import type { DetailedHTMLProps, HTMLAttributes } from 'react'

type IconifyProps = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
  icon?: string
  width?: string | number
  height?: string | number
  flip?: string
  rotate?: string | number
  inline?: boolean
}

declare global {
  namespace React.JSX {
    interface IntrinsicElements {
      'iconify-icon': IconifyProps
    }
  }
}
