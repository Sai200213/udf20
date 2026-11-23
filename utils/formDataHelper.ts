
import { FormField, FormSection } from '../types';

export const getApplicantName = (
  formData: Record<string, any>,
  formSections: FormSection[] // The specific form structure used by this applicant
): string | null => {
  if (!formData || !formSections) return null;

  let firstName: string | null = null;
  let lastName: string | null = null;
  let fullName: string | null = null;

  const nameFieldLabels = {
    full: ['full name', 'applicant name', 'employee name'],
    first: ['first name', 'given name'],
    last: ['last name', 'surname', 'family name'],
  };

  for (const section of formSections) {
    for (const field of section.fields) {
      const labelLower = field.label.toLowerCase();
      // Skip non-applicant names like Father's Name, Mother's Name, Bank Name, Company Name (UDF-AUD-149)
      if (labelLower.includes('father') || labelLower.includes('mother') || labelLower.includes('parent') ||
          labelLower.includes('bank') || labelLower.includes('company') || labelLower.includes('reference') ||
          labelLower.includes('spouse') || labelLower.includes('nominee')) {
        continue;
      }
      const value = formData[field.id];

      if (typeof value === 'string' && value.trim()) {
        if (nameFieldLabels.full.some(l => labelLower.includes(l))) {
          fullName = value.trim();
          break; // Found full name, prioritize this
        }
        if (nameFieldLabels.first.some(l => labelLower.includes(l))) {
          firstName = value.trim();
        }
        if (nameFieldLabels.last.some(l => labelLower.includes(l))) {
          lastName = value.trim();
        }
      }
    }
    if (fullName) break;
  }

  if (fullName) return fullName;
  if (firstName && lastName) return `${firstName} ${lastName}`;
  if (firstName) return firstName;
  if (lastName) return lastName;

  return 'N/A';
};

export const getApplicantEmail = (
  formData: Record<string, any>,
  formSections: FormSection[]
): string | null => {
  if (!formData || !formSections) return null;

  const emailFieldLabels = ['email', 'e-mail', 'personal email', 'official email'];

  for (const section of formSections) {
    for (const field of section.fields) {
      const labelLower = field.label.toLowerCase();
      // Skip non-applicant names like Father's Name, Mother's Name, Bank Name, Company Name (UDF-AUD-149)
      if (labelLower.includes('father') || labelLower.includes('mother') || labelLower.includes('parent') ||
          labelLower.includes('bank') || labelLower.includes('company') || labelLower.includes('reference') ||
          labelLower.includes('spouse') || labelLower.includes('nominee')) {
        continue;
      }
      const value = formData[field.id];

      if (typeof value === 'string' && value.trim()) {
        if (emailFieldLabels.some(l => labelLower.includes(l))) {
          return value.trim().toLowerCase();
        }
      }
    }
  }

  return null;
};

export const getApplicantPhone = (
  formData: Record<string, any>,
  formSections: FormSection[]
): string | null => {
  if (!formData || !formSections) return null;
  for (const section of formSections) {
    for (const field of section.fields || []) {
      const labelLower = field.label.toLowerCase();
      if (labelLower.includes('phone') || labelLower.includes('mobile')) {
        // Exclude parent phone numbers if an applicant phone number exists
        if (labelLower.includes('father') || labelLower.includes('mother') || labelLower.includes('parent') || labelLower.includes('reference')) {
          continue;
        }
        const val = formData[field.id];
        if (typeof val === 'string' && val.trim()) {
          const digits = val.replace(/\D/g, '');
          if (digits.length >= 10) return digits.slice(-10);
        }
      }
    }
  }
  return null;
};

export const getApplicantAadhaar = (
  formData: Record<string, any>,
  formSections: FormSection[]
): string | null => {
  if (!formData || !formSections) return null;
  for (const section of formSections) {
    for (const field of section.fields || []) {
      const labelLower = field.label.toLowerCase();
      if (labelLower.includes('aadhar') || labelLower.includes('aadhaar') || labelLower.includes('adhar')) {
        const val = formData[field.id];
        if (typeof val === 'string' && val.trim()) {
          const digits = val.replace(/\D/g, '');
          if (digits.length === 12) return digits;
          if (digits.length > 0) return digits;
        }
      }
    }
  }
  return null;
};

export const getApplicantPAN = (
  formData: Record<string, any>,
  formSections: FormSection[]
): string | null => {
  if (!formData || !formSections) return null;
  for (const section of formSections) {
    for (const field of section.fields || []) {
      const labelLower = field.label.toLowerCase();
      // Exclude company/experience substrings matching 'pan' (UDF-AUD-149)
      if (labelLower.includes('company') || labelLower.includes('companion') || labelLower.includes('experience')) {
        continue;
      }
      const isPanLabel = /(^|\b)pan(\b|\s*(card|no|number))|permanent account number/i.test(labelLower);
      if (isPanLabel) {
        const val = formData[field.id];
        if (typeof val === 'string' && val.trim()) {
          const clean = val.trim().toUpperCase().replace(/\s/g, '');
          if (/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(clean)) return clean;
          if (clean.length === 10) return clean;
        }
      }
    }
  }
  return null;
};

export const getApplicantUAN = (
  formData: Record<string, any>,
  formSections: FormSection[]
): string | null => {
  if (!formData || !formSections) return null;
  for (const section of formSections) {
    for (const field of section.fields || []) {
      const labelLower = field.label.toLowerCase();
      if (labelLower.includes('uan') || labelLower.includes('epfo')) {
        const val = formData[field.id];
        if (typeof val === 'string' && val.trim()) {
          const digits = val.replace(/\D/g, '');
          if (digits.length > 0) return digits;
        }
      }
    }
  }
  return null;
};

export const formatDate = (dateString?: string | Date): string => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    // Check if date is valid after parsing
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    return date.toLocaleDateString(undefined, { // Uses user's locale
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch (error) {
    return 'Invalid Date';
  }
};