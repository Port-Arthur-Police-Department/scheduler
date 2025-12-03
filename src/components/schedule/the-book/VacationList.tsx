// src/components/schedule/the-book/VacationListView.tsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plane } from "lucide-react";

export const VacationListView: React.FC = () => {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plane className="h-5 w-5" />
            Vacation List
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p className="mb-4">Vacation List view is under development.</p>
            <p className="text-sm">This view will show all upcoming vacations and PTO requests.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
