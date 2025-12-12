// src/components/admin/settings/AuditLogViewer.tsx
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Eye, Download, Trash2, Search, CalendarIcon } from "lucide-react";
import { format, subDays } from "date-fns";
import { cn } from "@/lib/utils";
import { exportAuditToPDF } from "@/utils/auditPdfExport";

interface AuditLog {
  id: string;
  user_email: string;
  action_type: string;
  table_name?: string;
  description: string;
  created_at: string;
  ip_address?: string;
  old_values?: any;
  new_values?: any;
}

export const AuditLogViewer = () => {
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: subDays(new Date(), 2),
    to: new Date()
  });
  const [selectedActionTypes, setSelectedActionTypes] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: auditLogs, isLoading } = useQuery({
    queryKey: ['audit-logs', dateRange, selectedActionTypes, selectedUsers, selectedTables],
    queryFn: async () => {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .gte('created_at', dateRange.from.toISOString())
        .lte('created_at', dateRange.to.toISOString())
        .order('created_at', { ascending: false });

      if (selectedActionTypes.length > 0) {
        query = query.in('action_type', selectedActionTypes);
      }

      if (selectedUsers.length > 0) {
        query = query.in('user_email', selectedUsers);
      }

      if (selectedTables.length > 0) {
        query = query.in('table_name', selectedTables);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching audit logs:', error);
        throw error;
      }

      return data as AuditLog[];
    },
  });

  const { data: distinctValues } = useQuery({
    queryKey: ['audit-distinct-values'],
    queryFn: async () => {
      const { data: actionTypes } = await supabase
        .from('audit_logs')
        .select('action_type')
        .not('action_type', 'is', null);

      const { data: users } = await supabase
        .from('audit_logs')
        .select('user_email')
        .not('user_email', 'is', null);

      const { data: tables } = await supabase
        .from('audit_logs')
        .select('table_name')
        .not('table_name', 'is', null);

      return {
        actionTypes: [...new Set(actionTypes?.map(a => a.action_type) || [])],
        users: [...new Set(users?.map(u => u.user_email) || [])],
        tables: [...new Set(tables?.map(t => t.table_name) || [])],
      };
    },
  });

  const filteredLogs = auditLogs?.filter(log => 
    log.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.user_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.action_type.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const handleExportPDF = async () => {
    if (!filteredLogs.length) {
      toast.error("No audit data to export");
      return;
    }

    try {
      const success = await exportAuditToPDF(
        filteredLogs,
        {
          startDate: dateRange.from,
          endDate: dateRange.to,
          actionTypes: selectedActionTypes,
          users: selectedUsers,
          tables: selectedTables
        },
        `audit-report-${new Date().toISOString().split('T')[0]}.pdf`
      );

      if (success) {
        toast.success("Audit report exported successfully");
      } else {
        toast.error("Failed to export audit report");
      }
    } catch (error) {
      toast.error("Error exporting audit report");
    }
  };

  const clearFilters = () => {
    setSelectedActionTypes([]);
    setSelectedUsers([]);
    setSelectedTables([]);
    setSearchQuery("");
    setDateRange({
      from: subDays(new Date(), 2),
      to: new Date()
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5" />
          Audit Logs
        </CardTitle>
        <CardDescription>
          View and export system activity and changes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 border rounded-lg">
          {/* Date Range */}
          <div className="space-y-2">
            <Label>Date Range</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dateRange && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd, y")} -{" "}
                        {format(dateRange.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={(range) => setDateRange(range as { from: Date; to: Date })}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Action Type Filter */}
          <div className="space-y-2">
            <Label>Action Type</Label>
            <Select
              value=""
              onValueChange={(value) => {
                if (value && !selectedActionTypes.includes(value)) {
                  setSelectedActionTypes([...selectedActionTypes, value]);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter by action" />
              </SelectTrigger>
              <SelectContent>
                {distinctValues?.actionTypes.map(type => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-1">
              {selectedActionTypes.map(type => (
                <Badge key={type} variant="secondary" className="flex items-center gap-1">
                  {type}
                  <button
                    onClick={() => setSelectedActionTypes(selectedActionTypes.filter(t => t !== type))}
                    className="hover:text-destructive"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          {/* User Filter */}
          <div className="space-y-2">
            <Label>User</Label>
            <Select
              value=""
              onValueChange={(value) => {
                if (value && !selectedUsers.includes(value)) {
                  setSelectedUsers([...selectedUsers, value]);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter by user" />
              </SelectTrigger>
              <SelectContent>
                {distinctValues?.users.map(user => (
                  <SelectItem key={user} value={user}>
                    {user}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-1">
              {selectedUsers.map(user => (
                <Badge key={user} variant="secondary" className="flex items-center gap-1">
                  {user}
                  <button
                    onClick={() => setSelectedUsers(selectedUsers.filter(u => u !== user))}
                    className="hover:text-destructive"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          {/* Search */}
          <div className="space-y-2">
            <Label>Search</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            <Button onClick={handleExportPDF} disabled={!filteredLogs.length}>
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
            <Button variant="outline" onClick={clearFilters}>
              <Trash2 className="h-4 w-4 mr-2" />
              Clear Filters
            </Button>
          </div>
          <Badge variant="secondary">
            {filteredLogs.length} events
          </Badge>
        </div>

        {/* Audit Logs Table */}
        <div className="border rounded-lg">
          <div className="max-h-96 overflow-auto">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">
                Loading audit logs...
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No audit logs found for the selected filters
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="p-2 text-left">Timestamp</th>
                    <th className="p-2 text-left">User</th>
                    <th className="p-2 text-left">Action</th>
                    <th className="p-2 text-left">Description</th>
                    <th className="p-2 text-left">IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="border-t hover:bg-muted/30">
                      <td className="p-2">
                        {format(new Date(log.created_at), 'MMM dd, yyyy HH:mm')}
                      </td>
                      <td className="p-2 font-medium">{log.user_email}</td>
                      <td className="p-2">
                        <Badge variant="outline">{log.action_type}</Badge>
                      </td>
                      <td className="p-2">{log.description}</td>
                      <td className="p-2 text-muted-foreground">
                        {log.ip_address || 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
