import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'

interface State { hasError: boolean; error: Error | null }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>💥</Text>
          <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 8 }}>Something went wrong</Text>
          <Text style={{ fontSize: 14, color: '#a3a3a3', textAlign: 'center', marginBottom: 24 }}>{this.state.error?.message}</Text>
          <TouchableOpacity
            onPress={() => this.setState({ hasError: false, error: null })}
            style={{ backgroundColor: '#7c3aed', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
          >
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )
    }
    return this.props.children
  }
}
