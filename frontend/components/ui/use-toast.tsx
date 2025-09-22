import { useState, useCallback } from 'react'

interface ToastProps {
  title?: string
  description?: string
  variant?: 'default' | 'destructive'
}

interface Toast extends ToastProps {
  id: string
}

const toasts: Toast[] = []
const listeners: Array<(toasts: Toast[]) => void> = []

function emit(toasts: Toast[]) {
  listeners.forEach((listener) => listener(toasts))
}

let toastId = 0

function toast(props: ToastProps) {
  const id = (++toastId).toString()
  const newToast: Toast = { ...props, id }
  
  toasts.push(newToast)
  emit([...toasts])
  
  setTimeout(() => {
    const index = toasts.findIndex(t => t.id === id)
    if (index > -1) {
      toasts.splice(index, 1)
      emit([...toasts])
    }
  }, 5000)
  
  return {
    id,
    dismiss: () => {
      const index = toasts.findIndex(t => t.id === id)
      if (index > -1) {
        toasts.splice(index, 1)
        emit([...toasts])
      }
    }
  }
}

function useToast() {
  const [toastList, setToastList] = useState<Toast[]>([...toasts])
  
  const subscribe = useCallback((listener: (toasts: Toast[]) => void) => {
    listeners.push(listener)
    return () => {
      const index = listeners.indexOf(listener)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [])
  
  useState(() => {
    const unsubscribe = subscribe(setToastList)
    return unsubscribe
  })
  
  return {
    toasts: toastList,
    toast,
    dismiss: (toastId?: string) => {
      if (toastId) {
        const index = toasts.findIndex(t => t.id === toastId)
        if (index > -1) {
          toasts.splice(index, 1)
          emit([...toasts])
        }
      }
    }
  }
}

export { useToast, toast }