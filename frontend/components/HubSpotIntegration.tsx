import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function HubSpotIntegration() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          HubSpot Integration
        </h1>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Integration Status</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 dark:text-gray-400">
            HubSpot integration functionality is being restored. Check back soon for full features.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}