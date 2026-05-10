export default function MaxLengthWarning({ value = '', max }) {
  if (!max || value.length < max) return null
  return (
    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
      Maximum {max} characters reached.
    </p>
  )
}
