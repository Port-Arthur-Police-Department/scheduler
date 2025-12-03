// src/components/schedule/the-book/ForceListView.tsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";

export const ForceListView: React.FC = () => {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Force List
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p className="mb-4">Force List view is under development.</p>
            <p className="text-sm">This view will show all officers by rank, badge number, and assignment status.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
