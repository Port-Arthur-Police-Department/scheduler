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

export const MinimumStaffingManager = () => {
  const [shifts, setShifts] = useState<ShiftType[]>([]);
  const [rules, setRules] = useState<MinimumStaffingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newRule, setNewRule] = useState({
    shift_type_id: '',
    day_of_week: 1,
    minimum_officers: 1,
    minimum_supervisors: 0,
  });

  useEffect(() => {
    fetchData();
  }, []);

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
        minimum_officers: 1,
        minimum_supervisors: 0,
      });
      toast.success('Staffing rule added successfully');
    } catch (error) {
      console.error('Error adding rule:', error);
      toast.error('Failed to add staffing rule');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateRule = async (id: string, field: string, value: number) => {
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
    } catch (error) {
      console.error('Error updating rule:', error);
      toast.error('Failed to update rule');
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
  } catch (error) {
    console.error('Error adding rules:', error);
    toast.error('Failed to add rules');
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
        <p className="text-sm text-gray-500">
          Set minimum staffing requirements for each shift and day of the week.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add New Rule Form */}
        <div className="space-y-4 p-4 border rounded-lg">
          <h3 className="font-semibold">Add New Staffing Rule</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="shift_type">Shift Type</Label>
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
              <Label htmlFor="day_of_week">Day of Week</Label>
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
                onChange={(e) => 
                  setNewRule({ 
                    ...newRule, 
                    minimum_officers: parseInt(e.target.value) || 0 
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="minimum_supervisors">Min Supervisors</Label>
              <Input
                type="number"
                min="0"
                value={newRule.minimum_supervisors}
                onChange={(e) => 
                  setNewRule({ 
                    ...newRule, 
                    minimum_supervisors: parseInt(e.target.value) || 0 
                  })
                }
              />
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
              return (
                <Button
                  key={shift.id}
                  variant="outline"
                  size="sm"
                  onClick={() => addRulesForAllDays(shift.id)}
                  disabled={saving || shiftRules.length === 7}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {shift.name} ({shiftRules.length}/7 days)
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
                          <Input
                            type="number"
                            min="0"
                            value={rule.minimum_officers}
                            onChange={(e) => 
                              handleUpdateRule(
                                rule.id, 
                                'minimum_officers', 
                                parseInt(e.target.value) || 0
                              )
                            }
                            disabled={saving}
                            className="w-20"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            value={rule.minimum_supervisors}
                            onChange={(e) => 
                              handleUpdateRule(
                                rule.id, 
                                'minimum_supervisors', 
                                parseInt(e.target.value) || 0
                              )
                            }
                            disabled={saving}
                            className="w-20"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteRule(rule.id)}
                            disabled={saving}
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
                ? Math.round(shiftRules.reduce((sum, r) => sum + r.minimum_officers, 0) / shiftRules.length)
                : 0;
              const avgSupervisors = shiftRules.length > 0 
                ? Math.round(shiftRules.reduce((sum, r) => sum + r.minimum_supervisors, 0) / shiftRules.length)
                : 0;

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
                  <div className="mt-2 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Avg. Officers:</span>
                      <span className="font-medium">{avgOfficers}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Avg. Supervisors:</span>
                      <span className="font-medium">{avgSupervisors}</span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
