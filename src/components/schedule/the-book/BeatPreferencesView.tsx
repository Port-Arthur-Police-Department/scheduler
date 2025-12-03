// src/components/schedule/the-book/BeatPreferencesView.tsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin } from "lucide-react";

export const BeatPreferencesView: React.FC = () => {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Beat Preferences
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p className="mb-4">Beat Preferences view is under development.</p>
            <p className="text-sm">This view will show officer beat/duty preferences and assignments.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
