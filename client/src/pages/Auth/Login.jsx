import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useMutation } from '@tanstack/react-query';
import { authAPI } from '../../api';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';

const schema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(6, 'Password min 6 chars'),
});

export default function Login() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: authAPI.login,
    onSuccess: ({ data }) => {
      setAuth(data.user, data.accessToken);
      window.__vaultAccessToken = data.accessToken;
      navigate('/dashboard');
      toast.success(`Welcome back, ${data.user.name}!`);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Login failed'),
  });

  const handleDemoLogin = () => mutation.mutate({ email: 'demo@vault.app', password: 'demo1234' });

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
      background: `
        radial-gradient(ellipse at 30% 30%, rgba(245,166,35,0.09) 0%, transparent 55%),
        radial-gradient(ellipse at 70% 70%, rgba(0,201,167,0.06) 0%, transparent 55%),
        #05060F
      `
    }}>
      <motion.div
        initial={{ opacity: 0, y: 32, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16,1,0.3,1] }}
        style={{ width: '100%', maxWidth: 420 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div className="logo-pulse" style={{
            width: 64, height: 64, borderRadius: 18,
            background: 'linear-gradient(145deg,#F7B733,#E08A00)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px',
            boxShadow: '0 8px 30px rgba(245,166,35,0.35), inset 0 1px 0 rgba(255,255,255,0.25)'
          }}>
            <span style={{ fontFamily: 'Outfit', fontWeight: 800, color: '#1C0E00', fontSize: 26 }}>V</span>
          </div>
          <h1 style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: 28, letterSpacing: '-0.03em', color: '#EAEDF5', marginBottom: 6 }}>
            Welcome back
          </h1>
          <p style={{ fontFamily: 'Inter', color: '#9295A8', fontSize: 14 }}>Sign in to your spend analyzer</p>
        </div>

        {/* Card */}
        <div className="gc" style={{ padding: 32 }}>
          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={{ display: 'block', fontFamily: 'Inter', fontSize: 12, fontWeight: 500, color: '#9295A8', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Email</label>
              <input type="email" className="gi" placeholder="you@example.com" {...register('email')} />
              {errors.email && <p style={{ fontFamily: 'Inter', fontSize: 12, color: '#FF5C5C', marginTop: 4 }}>{errors.email.message}</p>}
            </div>

            <div>
              <label style={{ display: 'block', fontFamily: 'Inter', fontSize: 12, fontWeight: 500, color: '#9295A8', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Password</label>
              <input type="password" className="gi" placeholder="••••••••" {...register('password')} />
              {errors.password && <p style={{ fontFamily: 'Inter', fontSize: 12, color: '#FF5C5C', marginTop: 4 }}>{errors.password.message}</p>}
            </div>

            <button type="submit" className="btn-amber" disabled={mutation.isPending}
              style={{ width: '100%', justifyContent: 'center', padding: 15, fontSize: 15, marginTop: 4, opacity: mutation.isPending ? 0.7 : 1 }}>
              {mutation.isPending ? 'Signing in...' : 'Sign In →'}
            </button>
          </form>

          <div style={{ borderTop: '0.5px solid rgba(255,255,255,0.07)', paddingTop: 18, textAlign: 'center', marginTop: 20 }}>
            <p style={{ fontFamily: 'Inter', fontSize: 13, color: '#9295A8' }}>
              Don't have an account?{' '}
              <Link to="/register" style={{ color: '#F5A623', textDecoration: 'none', fontWeight: 500 }}>Create one</Link>
            </p>
            <button onClick={handleDemoLogin}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter', fontSize: 13, color: '#4A4E65', marginTop: 10, textDecoration: 'underline', textDecorationStyle: 'dotted' }}>
              Try demo account
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
