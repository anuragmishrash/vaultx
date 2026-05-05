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
  name: z.string().min(2, 'Name required'),
  email: z.string().email('Valid email required'),
  password: z.string().min(6, 'Min 6 characters'),
  confirmPassword: z.string(),
  monthlySalary: z.coerce.number().optional(),
  monthlyBudget: z.coerce.number().optional(),
}).refine(d => d.password === d.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });

export default function Register() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: authAPI.register,
    onSuccess: ({ data }) => {
      setAuth(data.user, data.accessToken);
      window.__vaultAccessToken = data.accessToken;
      navigate('/dashboard');
      toast.success(`Welcome to VAULT, ${data.user.name}!`);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Registration failed'),
  });

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
      background: `
        radial-gradient(ellipse at 35% 35%, rgba(155,138,251,0.08) 0%, transparent 55%),
        radial-gradient(ellipse at 65% 65%, rgba(245,166,35,0.07) 0%, transparent 55%),
        #05060F
      `
    }}>
      <motion.div
        initial={{ opacity: 0, y: 32, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16,1,0.3,1] }}
        style={{ width: '100%', maxWidth: 420 }}>

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
            Create your account
          </h1>
          <p style={{ fontFamily: 'Inter', color: '#9295A8', fontSize: 14 }}>Start understanding your spending today</p>
        </div>

        <div className="gc" style={{ padding: 32 }}>
          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontFamily: 'Inter', fontSize: 12, fontWeight: 500, color: '#9295A8', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Full Name</label>
              <input className="gi" placeholder="Anurag Sharma" {...register('name')} />
              {errors.name && <p style={{ fontSize: 12, color: '#FF5C5C', marginTop: 4 }}>{errors.name.message}</p>}
            </div>

            <div>
              <label style={{ display: 'block', fontFamily: 'Inter', fontSize: 12, fontWeight: 500, color: '#9295A8', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Email</label>
              <input type="email" className="gi" placeholder="you@example.com" {...register('email')} />
              {errors.email && <p style={{ fontSize: 12, color: '#FF5C5C', marginTop: 4 }}>{errors.email.message}</p>}
            </div>

            <div>
              <label style={{ display: 'block', fontFamily: 'Inter', fontSize: 12, fontWeight: 500, color: '#9295A8', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Password</label>
              <input type="password" className="gi" placeholder="••••••••" {...register('password')} />
              {errors.password && <p style={{ fontSize: 12, color: '#FF5C5C', marginTop: 4 }}>{errors.password.message}</p>}
            </div>

            <div>
              <label style={{ display: 'block', fontFamily: 'Inter', fontSize: 12, fontWeight: 500, color: '#9295A8', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Confirm Password</label>
              <input type="password" className="gi" placeholder="••••••••" {...register('confirmPassword')} />
              {errors.confirmPassword && <p style={{ fontSize: 12, color: '#FF5C5C', marginTop: 4 }}>{errors.confirmPassword.message}</p>}
            </div>

            <div style={{ borderTop: '0.5px solid rgba(255,255,255,0.07)', paddingTop: 16 }}>
              <p style={{ fontFamily: 'Inter', fontSize: 11, color: '#4A4E65', marginBottom: 12 }}>Optional — used for time-cost calculations</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontFamily: 'Inter', fontSize: 12, fontWeight: 500, color: '#9295A8', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Monthly Salary</label>
                  <input type="number" className="gi" placeholder="₹60,000" {...register('monthlySalary')} />
                </div>
                <div>
                  <label style={{ display: 'block', fontFamily: 'Inter', fontSize: 12, fontWeight: 500, color: '#9295A8', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Monthly Budget</label>
                  <input type="number" className="gi" placeholder="₹35,000" {...register('monthlyBudget')} />
                </div>
              </div>
            </div>

            <button type="submit" className="btn-amber" disabled={mutation.isPending}
              style={{ width: '100%', justifyContent: 'center', padding: 15, fontSize: 15, marginTop: 4, opacity: mutation.isPending ? 0.7 : 1 }}>
              {mutation.isPending ? 'Creating...' : 'Create Account →'}
            </button>
          </form>

          <div style={{ borderTop: '0.5px solid rgba(255,255,255,0.07)', paddingTop: 18, textAlign: 'center', marginTop: 20 }}>
            <p style={{ fontFamily: 'Inter', fontSize: 13, color: '#9295A8' }}>
              Already have an account?{' '}
              <Link to="/login" style={{ color: '#F5A623', textDecoration: 'none', fontWeight: 500 }}>Sign in</Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
