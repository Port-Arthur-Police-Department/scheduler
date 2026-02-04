// src/components/admin/settings/MinimumStaffingManager.tsx
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ShiftType {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
}

interface MinimumStaffingRule {
  id: string;
  shift_type_id: string;
  day_of_week: number;
  minimum_officers: number;
  minimum_supervisors: number;
  shift_type?: ShiftType;
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

// Helper function to get smart defaults based on shift name
const getDefaultStaffingForShift = (shiftName: string) => {
  const lowerName = shiftName.toLowerCase();
  
  if (lowerName.includes('admin')) {
    return { officers: 0, supervisors: 0 };
  }
  if (lowerName.includes('supervisor') || lowerName.includes('command')) {
    return { officers: 0, supervisors: 1 };
  }
  if (lowerName.includes('day') || lowerName.includes('morning')) {
    return { officers: 8, supervisors: 2 };
  }
  if (lowerName.includes('evening') || lowerName.includes('swing')) {
    return { officers: 6, supervisors: 1 };
  }
  if (lowerName.includes('night') || lowerName.includes('graveyard')) {
    return { officers: 4, supervisors: 1 };
  }
  
  // Default values for other shifts
  return { officers: 0, supervisors: 0 };
};

export const MinimumStaffingManager = () => {
  const [shifts, setShifts] = useState<ShiftType[]>([]);
  const [rules, setRules] = useState<MinimumStaffingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newRule, setNewRule] = useState({
    shift_type_id: '',
    day_of_week: 1,
    minimum_officers: 0,
    minimum_supervisors: 0,
  });

  useEffect(() => {
    fetchData();
  }, []);

  // Update defaults when shift is selected
  useEffect(() => {
    if (newRule.shift_type_id) {
      const selectedShift = shifts.find(s => s.id === newRule.shift_type_id);
      if (selectedShift) {
        const defaults = getDefaultStaffingForShift(selectedShift.name);
        setNewRule(prev => ({
          ...prev,
          minimum_officers: defaults.officers,
          minimum_supervisors: defaults.supervisors,
        }));
      }
    }
  }, [newRule.shift_type_id, shifts]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch all shift types
      const { data: shiftData, error: shiftError } = await supabase
        .from('shift_types')
        .select('*')
        .order('start_time');

      if (shiftError) throw shiftError;
      setShifts(shiftData || []);

      // Fetch all minimum staffing rules with shift type info
      const { data: rulesData, error: rulesError } = await supabase
        .from('minimum_staffing')
        .select(`
          *,
          shift_type:shift_type_id (id, name, start_time, end_time)
        `)
        .order('day_of_week');

      if (rulesError) throw rulesError;
      setRules(rulesData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load staffing rules');
    } finally {
      setLoading(false);
    }
  };

  const handleAddRule = async () => {
    if (!newRule.shift_type_id) {
      toast.error('Please select a shift type');
      return;
    }

    // Validation: Ensure values are not negative
    if (newRule.minimum_officers < 0) {
      toast.error('Minimum officers cannot be negative');
      return;
    }

    if (newRule.minimum_supervisors < 0) {
      toast.error('Minimum supervisors cannot be negative');
      return;
    }

    // Check if rule already exists for this shift and day
    const existingRule = rules.find(
      rule => 
        rule.shift_type_id === newRule.shift_type_id && 
        rule.day_of_week === newRule.day_of_week
    );

    if (existingRule) {
      toast.error('A rule already exists for this shift and day');
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('minimum_staffing')
        .insert([{
          shift_type_id: newRule.shift_type_id,
          day_of_week: newRule.day_of_week,
          minimum_officers: newRule.minimum_officers,
          minimum_supervisors: newRule.minimum_supervisors,
        }])
        .select(`
          *,
          shift_type:shift_type_id (id, name, start_time, end_time)
        `)
        .single();

      if (error) throw error;

      setRules([...rules, data]);
      setNewRule({
        shift_type_id: '',
        day_of_week: 1,
        minimum_officers: 0,
        minimum_supervisors: 0,
      });
      toast.success('Staffing rule added successfully');
    } catch (error: any) {
      console.error('Error adding rule:', error);
      // Check if it's the constraint error
      if (error.code === '23514') {
        toast.error('Database constraint error: Please ensure minimum officers is 0 or greater');
      } else {
        toast.error('Failed to add staffing rule');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateRule = async (id: string, field: string, value: number) => {
    // Validate value is not negative
    if (value < 0) {
      toast.error('Value cannot be negative');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('minimum_staffing')
        .update({ [field]: value })
        .eq('id', id);

      if (error) throw error;

      setRules(rules.map(rule => 
        rule.id === id ? { ...rule, [field]: value } : rule
      ));
      toast.success('Rule updated successfully');
    } catch (error: any) {
      console.error('Error updating rule:', error);
      if (error.code === '23514') {
        toast.error('Database constraint error: Please ensure value is 0 or greater');
      } else {
        toast.error('Failed to update rule');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRule = async (id: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('minimum_staffing')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setRules(rules.filter(rule => rule.id !== id));
      toast.success('Rule deleted successfully');
    } catch (error) {
      console.error('Error deleting rule:', error);
      toast.error('Failed to delete rule');
    } finally {
      setSaving(false);
    }
  };

  const addRulesForAllDays = async (shiftId: string) => {
    const shift = shifts.find(s => s.id === shiftId);
    if (!shift) return;

    setSaving(true);
    try {
      // Check if any rules already exist for this shift
      const existingRules = rules.filter(rule => rule.shift_type_id === shiftId);
      const existingDays = existingRules.map(rule => rule.day_of_week);

      // Get smart defaults based on shift name
      const defaults = getDefaultStaffingForShift(shift.name);

      // Prepare rules for missing days with smart defaults
      const rulesToAdd = DAYS_OF_WEEK
        .filter(day => !existingDays.includes(day.value))
        .map(day => ({
          shift_type_id: shiftId,
          day_of_week: day.value,
          minimum_officers: defaults.officers,
          minimum_supervisors: defaults.supervisors,
        }));

      if (rulesToAdd.length === 0) {
        toast.info('Rules already exist for all days');
        return;
      }

      const { data, error } = await supabase
        .from('minimum_staffing')
        .insert(rulesToAdd)
        .select(`
          *,
          shift_type:shift_type_id (id, name, start_time, end_time)
        `);

      if (error) throw error;

      setRules([...rules, ...(data || [])]);
      toast.success(`Added ${rulesToAdd.length} rules for ${shift.name}`);
    } catch (error: any) {
      console.error('Error adding rules:', error);
      if (error.code === '23514') {
        toast.error('Database constraint error: Please run the SQL to update constraints');
      } else {
        toast.error('Failed to add rules');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center items-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2">Loading staffing rules...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Minimum Staffing Configuration</CardTitle>
        <div className="space-y-2">
          <p className="text-sm text-gray-500">
            Set minimum staffing requirements for each shift and day of the week.
          </p>
          <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
            <strong>Important:</strong> To use 0 as a minimum value, you need to run this SQL in your Supabase SQL Editor:
            <pre className="mt-1 bg-gray-100 p-2 rounded text-xs overflow-x-auto">
              {`ALTER TABLE public.minimum_staffing 
DROP CONSTRAINT IF EXISTS minimum_staffing_minimum_officers_check;

ALTER TABLE public.minimum_staffing 
ADD CONSTRAINT minimum_staffing_minimum_officers_check 
CHECK (minimum_officers >= 0);`}
            </pre>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add New Rule Form */}
        <div className="space-y-4 p-4 border rounded-lg">
          <h3 className="font-semibold">Add New Staffing Rule</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="shift_type">Shift Type *</Label>
              <Select
                value={newRule.shift_type_id}
                onValueChange={(value) => 
                  setNewRule({ ...newRule, shift_type_id: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select shift" />
                </SelectTrigger>
                <SelectContent>
                  {shifts.map(shift => (
                    <SelectItem key={shift.id} value={shift.id}>
                      {shift.name} ({shift.start_time} - {shift.end_time})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="day_of_week">Day of Week *</Label>
              <Select
                value={newRule.day_of_week.toString()}
                onValueChange={(value) => 
                  setNewRule({ ...newRule, day_of_week: parseInt(value) })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  {DAYS_OF_WEEK.map(day => (
                    <SelectItem key={day.value} value={day.value.toString()}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="minimum_officers">Min Officers</Label>
              <Input
                type="number"
                min="0"
                value={newRule.minimum_officers}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  setNewRule({ 
                    ...newRule, 
                    minimum_officers: value >= 0 ? value : 0
                  });
                }}
                className="w-full"
              />
              <p className="text-xs text-gray-500">Enter 0 if no minimum required</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="minimum_supervisors">Min Supervisors</Label>
              <Input
                type="number"
                min="0"
                value={newRule.minimum_supervisors}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  setNewRule({ 
                    ...newRule, 
                    minimum_supervisors: value >= 0 ? value : 0
                  });
                }}
                className="w-full"
              />
              <p className="text-xs text-gray-500">Enter 0 if no minimum required</p>
            </div>
          </div>
          <Button 
            onClick={handleAddRule} 
            disabled={saving || !newRule.shift_type_id}
            className="w-full"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Add Rule
          </Button>
        </div>

        {/* Quick Add All Days for Each Shift */}
        <div className="space-y-4">
          <h3 className="font-semibold">Quick Setup</h3>
          <p className="text-sm text-gray-500">
            Add rules for all 7 days to a shift (will skip existing days)
          </p>
          <div className="flex flex-wrap gap-2">
            {shifts.map(shift => {
              const shiftRules = rules.filter(r => r.shift_type_id === shift.id);
              const defaults = getDefaultStaffingForShift(shift.name);
              
              return (
                <Button
                  key={shift.id}
                  variant="outline"
                  size="sm"
                  onClick={() => addRulesForAllDays(shift.id)}
                  disabled={saving || shiftRules.length === 7}
                  className="flex flex-col items-start h-auto py-2"
                >
                  <div className="flex items-center">
                    <Plus className="h-3 w-3 mr-1" />
                    <span className="font-medium">{shift.name}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {shiftRules.length}/7 days • Default: {defaults.officers} off, {defaults.supervisors} sup
                  </div>
                </Button>
              );
            })}
          </div>
        </div>

        {/* Existing Rules Table */}
        <div className="space-y-4">
          <h3 className="font-semibold">Current Staffing Rules</h3>
          {rules.length === 0 ? (
            <p className="text-gray-500 text-center py-4">
              No staffing rules configured yet. Add rules above.
            </p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Shift</TableHead>
                    <TableHead>Day</TableHead>
                    <TableHead>Min Officers</TableHead>
                    <TableHead>Min Supervisors</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((rule) => {
                    const shift = shifts.find(s => s.id === rule.shift_type_id);
                    const day = DAYS_OF_WEEK.find(d => d.value === rule.day_of_week);
                    
                    return (
                      <TableRow key={rule.id}>
                        <TableCell className="font-medium">
                          {shift?.name || 'Unknown Shift'}
                        </TableCell>
                        <TableCell>{day?.label || 'Unknown Day'}</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Input
                              type="number"
                              min="0"
                              value={rule.minimum_officers}
                              onChange={(e) => {
                                const value = parseInt(e.target.value) || 0;
                                handleUpdateRule(
                                  rule.id, 
                                  'minimum_officers', 
                                  value >= 0 ? value : 0
                                );
                              }}
                              disabled={saving}
                              className={`w-20 ${rule.minimum_officers === 0 ? 'border-amber-200 bg-amber-50' : ''}`}
                            />
                            {rule.minimum_officers === 0 && (
                              <span className="text-xs text-amber-600">No min</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Input
                              type="number"
                              min="0"
                              value={rule.minimum_supervisors}
                              onChange={(e) => {
                                const value = parseInt(e.target.value) || 0;
                                handleUpdateRule(
                                  rule.id, 
                                  'minimum_supervisors', 
                                  value >= 0 ? value : 0
                                );
                              }}
                              disabled={saving}
                              className={`w-20 ${rule.minimum_supervisors === 0 ? 'border-amber-200 bg-amber-50' : ''}`}
                            />
                            {rule.minimum_supervisors === 0 && (
                              <span className="text-xs text-amber-600">No min</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteRule(rule.id)}
                            disabled={saving}
                            className="hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Summary by Shift */}
        <div className="space-y-4">
          <h3 className="font-semibold">Summary by Shift</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {shifts.map(shift => {
              const shiftRules = rules.filter(r => r.shift_type_id === shift.id);
              const avgOfficers = shiftRules.length > 0 
                ? Math.round(shiftRules.reduce((sum, r) => sum + r.minimum_officers, 0) / shiftRules.length * 10) / 10
                : 0;
              const avgSupervisors = shiftRules.length > 0 
                ? Math.round(shiftRules.reduce((sum, r) => sum + r.minimum_supervisors, 0) / shiftRules.length * 10) / 10
                : 0;
              const zeroOfficerDays = shiftRules.filter(r => r.minimum_officers === 0).length;
              const zeroSupervisorDays = shiftRules.filter(r => r.minimum_supervisors === 0).length;

              return (
                <Card key={shift.id} className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold">{shift.name}</h4>
                      <p className="text-sm text-gray-500">
                        {shiftRules.length}/7 days configured
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => addRulesForAllDays(shift.id)}
                      disabled={saving || shiftRules.length === 7}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Avg. Officers:</span>
                      <span className={`font-medium ${avgOfficers === 0 ? 'text-amber-600' : ''}`}>
                        {avgOfficers.toFixed(1)}
                        {zeroOfficerDays > 0 && ` (${zeroOfficerDays}×0)`}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Avg. Supervisors:</span>
                      <span className={`font-medium ${avgSupervisors === 0 ? 'text-amber-600' : ''}`}>
                        {avgSupervisors.toFixed(1)}
                        {zeroSupervisorDays > 0 && ` (${zeroSupervisorDays}×0)`}
                      </span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Database Update Instructions */}
        <div className="p-4 border border-amber-200 bg-amber-50 rounded-lg">
          <h4 className="font-semibold text-amber-800 mb-2">
            Database Constraint Update Required
          </h4>
          <p className="text-sm text-amber-700 mb-3">
            To allow 0 as a minimum value, you must update the database constraint.
            Run this SQL in your Supabase SQL Editor:
          </p>
          <pre className="text-xs bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto">
{`-- Drop the old constraint (requires minimum_officers > 0)
ALTER TABLE public.minimum_staffing 
DROP CONSTRAINT IF EXISTS minimum_staffing_minimum_officers_check;

-- Create new constraint (allows minimum_officers >= 0)
ALTER TABLE public.minimum_staffing 
ADD CONSTRAINT minimum_staffing_minimum_officers_check 
CHECK (minimum_officers >= 0);

-- Optional: Do the same for supervisors if needed
ALTER TABLE public.minimum_staffing 
DROP CONSTRAINT IF EXISTS minimum_staffing_minimum_supervisors_check;

ALTER TABLE public.minimum_staffing 
ADD CONSTRAINT minimum_staffing_minimum_supervisors_check 
CHECK (minimum_supervisors >= 0);`}
          </pre>
          <p className="text-xs text-amber-600 mt-2">
            After running this SQL, the constraint error will no longer occur.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
