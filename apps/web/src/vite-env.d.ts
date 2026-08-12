/// <reference types="vite/client" />

declare module '*.css' {}

import type { HTMLAttributes } from 'react'

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'iconify-icon': HTMLAttributes<HTMLElement> & {
        icon?: string
        width?: string | number
        height?: string | number
      }
    }
  }
}
