import { forwardRef } from 'react';
import clsx from 'clsx';

const Input = forwardRef(({ label, error, prefix, className = '', ...props }, ref) => {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label style={{ fontFamily: 'Inter', fontSize: '12px', fontWeight: 500, color: '#9295A8', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {label}
        </label>
      )}
      <div className="relative">
        {prefix && (
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-vault-text3 font-medium text-sm">{prefix}</span>
        )}
        <input
          ref={ref}
          className={clsx('gi', prefix && '!pl-8', className)}
          {...props}
        />
      </div>
      {error && <p style={{ fontFamily: 'Inter', fontSize: '12px', color: '#FF5C5C', marginTop: '2px' }}>{error}</p>}
    </div>
  );
});

Input.displayName = 'Input';
export default Input;
