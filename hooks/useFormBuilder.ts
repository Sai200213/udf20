
import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { FormSection, FormField, FieldType } from '../types';

export const useFormBuilder = (initialSections: FormSection[] = []) => {
  const [sections, setSections] = useState<FormSection[]>(initialSections);

  const addSection = useCallback((name: string) => {
    setSections(prev => [
      ...prev,
      {
        id: uuidv4(),
        name,
        order: prev.length,
        fields: [],
        isDisabled: false,
      }
    ]);
  }, []);

  const updateSectionName = useCallback((sectionId: string, newName: string) => {
    setSections(prev =>
      prev.map(section =>
        section.id === sectionId ? { ...section, name: newName } : section
      )
    );
  }, []);

  const deleteSection = useCallback((sectionId: string) => {
    setSections(prev => prev.filter(section => section.id !== sectionId)
        .map((s, index) => ({ ...s, order: index })) // Re-order remaining
    );
  }, []);

  const toggleSectionStatus = useCallback((sectionId: string) => {
    setSections(prev => prev.map(section => 
        section.id === sectionId ? { ...section, isDisabled: !section.isDisabled } : section
    ));
  }, []);

  const reorderSections = useCallback((sourceIndex: number, destinationIndex: number) => {
    setSections(prev => {
      // Sort first by .order so visual indices match the array being spliced (UDF-AUD-146)
      const sorted = [...prev].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      const [removed] = sorted.splice(sourceIndex, 1);
      if (removed) {
        sorted.splice(destinationIndex, 0, removed);
      }
      return sorted.filter((s): s is FormSection => !!s).map((s, index) => ({ ...s, order: index }));
    });
  }, []);

  const addField = useCallback((sectionId: string, fieldData: Omit<FormField, 'id' | 'order'>) => {
    setSections(prev =>
      prev.map(section => {
        if (section.id === sectionId) {
          const newField: FormField = {
            ...fieldData,
            id: uuidv4(),
            order: section.fields.length,
            isDisabled: false,
          };
          return { ...section, fields: [...section.fields, newField] };
        }
        return section;
      })
    );
  }, []);

  const updateField = useCallback((sectionId: string, fieldId: string, updates: Partial<Omit<FormField, 'id' | 'order'>>) => {
    setSections(prev =>
      prev.map(section => {
        if (section.id === sectionId) {
          return {
            ...section,
            fields: section.fields.map(field =>
              field.id === fieldId ? { ...field, ...updates } : field
            ),
          };
        }
        return section;
      })
    );
  }, []);

  const deleteField = useCallback((sectionId: string, fieldId: string) => {
    setSections(prev =>
      prev.map(section => {
        if (section.id === sectionId) {
          return {
            ...section,
            fields: section.fields.filter(field => field.id !== fieldId)
                .map((f, index) => ({ ...f, order: index })), // Re-order remaining
          };
        }
        return section;
      })
    );
  }, []);

  const toggleFieldStatus = useCallback((sectionId: string, fieldId: string) => {
    setSections(prev => prev.map(section => {
        if (section.id === sectionId) {
            return {
                ...section,
                fields: section.fields.map(f => f.id === fieldId ? { ...f, isDisabled: !f.isDisabled } : f)
            };
        }
        return section;
    }));
  }, []);

  const reorderFields = useCallback((sectionId: string, sourceIndex: number, destinationIndex: number) => {
    setSections(prev =>
      prev.map(section => {
        if (section.id === sectionId) {
          // Sort first by .order so visual indices match the array being spliced (UDF-AUD-146)
          const sorted = [...section.fields].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
          const [removed] = sorted.splice(sourceIndex, 1);
          if (removed) {
            sorted.splice(destinationIndex, 0, removed);
          }
          return { 
            ...section, 
            fields: sorted.filter((f): f is FormField => !!f).map((f, index) => ({ ...f, order: index })) 
          };
        }
        return section;
      })
    );
  }, []);

  return {
    sections,
    setSections,
    addSection,
    updateSectionName,
    deleteSection,
    toggleSectionStatus,
    reorderSections,
    addField,
    updateField,
    deleteField,
    toggleFieldStatus,
    reorderFields,
  };
};
