import type { LanguageConfig } from '../../types';
import { SUPPORTED_LANGUAGES } from '../../data/languages';

export interface LanguageSelectorProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  languages?: LanguageConfig[];
  disabled?: boolean;
  className?: string;
}

const DEFAULT_LANGUAGES: LanguageConfig[] = SUPPORTED_LANGUAGES;

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  label,
  value,
  onChange,
  languages = DEFAULT_LANGUAGES,
  disabled = false,
  className = '',
}) => {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-xs font-semibold text-[#5A6270] tracking-wider uppercase">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full appearance-none bg-white border border-[#E5E2D9] rounded-xl px-4 py-3 pr-10 text-sm font-medium text-[#20242C] focus-visible:ring-2 focus-visible:ring-[#3563E9] focus-visible:outline-none transition-colors hover:border-[#D5D1C6] disabled:bg-[#F2EFE8] disabled:cursor-not-allowed cursor-pointer"
        >
          {languages.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.flag} {lang.name} ({lang.nativeName}) {lang.status === 'beta' ? '— Beta' : ''}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-[#5A6270]">
          <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
          </svg>
        </div>
      </div>
    </div>
  );
};
