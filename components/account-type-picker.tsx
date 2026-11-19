'use client';
import { Check, GraduationCap, Store } from 'lucide-react';
import { ACCOUNT_TYPES, BUSINESS_CATEGORIES } from '../lib/account-type';
import type { AccountType } from '../lib/account-type';

/** Two large radio cards: "I am a student" / "I am a vendor". Used when registering and when switching. */
export function AccountTypePicker({ value, onChange, name = 'account-type', legend = 'I am joining as', required = true, compact = false }: {
  value: AccountType | '';
  onChange: (next: AccountType) => void;
  name?: string;
  legend?: string;
  required?: boolean;
  compact?: boolean;
}) {
  return (
    <fieldset className={`accountPicker ${compact ? 'compact' : ''}`}>
      <legend>{legend}{required && <span className="requiredMark">Required</span>}</legend>
      <div className="accountChoices">
        {(['student', 'vendor'] as const).map(type => {
          const Icon = type === 'vendor' ? Store : GraduationCap;
          const selected = value === type;
          return (
            <label key={type} className={`accountCard ${type} ${selected ? 'selected' : ''}`}>
              <input className="srOnly" type="radio" name={name} value={type} checked={selected} onChange={() => onChange(type)} required={required} />
              <span className="accountCardIcon"><Icon size={22} /></span>
              <span className="accountCardBody">
                <b>{ACCOUNT_TYPES[type].label}</b>
                <span>{ACCOUNT_TYPES[type].tagline}</span>
                {!compact && selected && <ul>{ACCOUNT_TYPES[type].points.map(point => <li key={point}>{point}</li>)}</ul>}
              </span>
              <span className="accountCardCheck" aria-hidden="true">{selected && <Check size={14} strokeWidth={3} />}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Business details shown once "Vendor" is chosen. */
export function VendorFields({ businessName, onBusinessName, category, onCategory, idPrefix = 'vendor' }: {
  businessName: string;
  onBusinessName: (value: string) => void;
  category: string;
  onCategory: (value: string) => void;
  idPrefix?: string;
}) {
  return (
    <div className="vendorFields">
      <div className="field">
        <label htmlFor={`${idPrefix}-business`}>Business / shop name</label>
        <input id={`${idPrefix}-business`} value={businessName} maxLength={80} minLength={2} onChange={e => onBusinessName(e.target.value)} placeholder="e.g. TechWorld Gadgets" required autoComplete="organization" />
        <small>Shown on your public profile and used to set up your storefront.</small>
      </div>
      <div className="field">
        <label htmlFor={`${idPrefix}-category`}>What do you mainly sell? <span className="muted">(optional)</span></label>
        <select id={`${idPrefix}-category`} value={category} onChange={e => onCategory(e.target.value)}>
          <option value="">Choose a category</option>
          {BUSINESS_CATEGORIES.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
      </div>
    </div>
  );
}
