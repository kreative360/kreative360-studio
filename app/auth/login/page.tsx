'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (data.success) {
        router.push(redirect);
        router.refresh();
      } else {
        setError('Contraseña incorrecta');
      }
    } catch (err) {
      setError('Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 50%, #ffeaa7 100%)',
      zIndex: 9999,
      padding: '20px',
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: 20,
        padding: 48,
        maxWidth: 440,
        width: '100%',
        boxShadow: '0 20px 60px rgba(255, 107, 107, 0.3)',
      }}>
        {/* Logo / Icono */}
        <div style={{
          textAlign: 'center',
          marginBottom: 32,
        }}>
          <div style={{
            width: 80,
            height: 80,
            background: 'linear-gradient(135deg, #ff6b6b 0%, #ffa07a 100%)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            fontSize: 40,
          }}>
            🔐
          </div>
          <h1 style={{
            fontSize: 28,
            fontWeight: 800,
            color: '#ff6b6b',
            marginBottom: 8,
          }}>
            Kreative 360º Studio
          </h1>
          <p style={{
            fontSize: 15,
            color: '#6b7280',
          }}>
            Ingresa tu contraseña para continuar
          </p>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 20 }}>
            <label style={{
              display: 'block',
              fontSize: 14,
              fontWeight: 600,
              color: '#374151',
              marginBottom: 8,
            }}>
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px 16px',
                border: '2px solid #e5e7eb',
                borderRadius: 12,
                fontSize: 16,
                outline: 'none',
                transition: 'all 0.2s',
                background: '#f9fafb',
              }}
              placeholder="Ingresa tu contraseña"
              autoFocus
              onFocus={(e) => e.target.style.borderColor = '#ff6b6b'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            />
          </div>

          {error && (
            <div style={{
              marginBottom: 20,
              padding: 14,
              background: '#fee2e2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <span>⚠️</span>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px 24px',
              background: loading ? '#9ca3af' : 'linear-gradient(135deg, #ff6b6b 0%, #ffa07a 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 12,
              fontSize: 16,
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              boxShadow: loading ? 'none' : '0 4px 14px rgba(255, 107, 107, 0.4)',
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(255, 107, 107, 0.6)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(255, 107, 107, 0.4)';
              }
            }}
          >
            {loading ? 'Verificando...' : 'Entrar'}
          </button>
        </form>

        <div style={{
          marginTop: 24,
          padding: 16,
          background: '#fff5f5',
          borderRadius: 12,
          textAlign: 'center',
          border: '1px solid #ffe4e4',
        }}>
          <p style={{
            fontSize: 13,
            color: '#6b7280',
            marginBottom: 8,
          }}>
            💡 Contraseña por defecto
          </p>
          <code style={{
            display: 'inline-block',
            background: '#ffffff',
            border: '1px solid #fecaca',
            padding: '6px 12px',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            color: '#ff6b6b',
            fontFamily: 'monospace',
          }}>
            kreative2024
          </code>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 50%, #ffeaa7 100%)',
        zIndex: 9999,
      }}>
        <div style={{
          background: '#ffffff',
          padding: 40,
          borderRadius: 20,
          boxShadow: '0 20px 60px rgba(255, 107, 107, 0.3)',
        }}>
          <div style={{
            width: 40,
            height: 40,
            border: '4px solid #f3f4f6',
            borderTop: '4px solid #ff6b6b',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto',
          }}/>
          <p style={{
            marginTop: 16,
            color: '#6b7280',
            fontSize: 14,
          }}>
            Cargando...
          </p>
        </div>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}