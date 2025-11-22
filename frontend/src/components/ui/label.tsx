import { LabelHTMLAttributes, forwardRef } from 'react'

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  className?: string
}

const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className = '', ...props }, ref) => (
    <label
      ref={ref}
      className={`text-sm font-medium text-gray-700 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`}
      {...props}
    />
  )
)
Label.displayName = 'Label'

export { Label }