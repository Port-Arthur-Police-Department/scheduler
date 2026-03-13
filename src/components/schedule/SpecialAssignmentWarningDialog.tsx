// Create a new file: SpecialAssignmentWarningDialog.tsx
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Users } from "lucide-react";

interface SpecialAssignmentWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  officer: any;
  partnerData: any;
  onConfirm: () => void;
  onCancel: () => void;
}

export const SpecialAssignmentWarningDialog = ({
  open,
  onOpenChange,
  officer,
  partnerData,
  onConfirm,
  onCancel
}: SpecialAssignmentWarningDialogProps) => {
  if (!partnerData) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            Partnership Will Be Suspended
          </DialogTitle>
          <DialogDescription>
            {officer.name} is currently in a partnership with {partnerData.partnerName}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <h4 className="font-medium text-amber-800 mb-2">What will happen:</h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <Users className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <span>
                  <span className="font-medium">Partnership Suspended:</span> The partnership between{" "}
                  <strong>{officer.name}</strong> and <strong>{partnerData.partnerName}</strong> will be suspended.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <span>
                  <span className="font-medium">Emergency Partner Needed:</span> If{" "}
                  <strong>{partnerData.partnerName}</strong> is a PPO (Probationary Officer), they will need an{" "}
                  <strong className="text-amber-700">emergency partner</strong> for today.
                </span>
              </li>
              <li className="text-amber-700 text-xs bg-amber-100 p-2 rounded mt-2">
                ⚠️ PPOs cannot work alone and must be assigned an emergency partner immediately.
              </li>
            </ul>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button 
              onClick={onConfirm}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Confirm Special Assignment
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
