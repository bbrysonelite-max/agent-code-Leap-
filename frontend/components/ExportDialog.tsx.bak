import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Download,
  FileText,
  Table,
  BarChart3,
  Palette,
  Building,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { useReporting } from '../hooks/useReporting';

interface ExportDialogProps {
  reportId: string;
  open: boolean;
  onClose: () => void;
}

const EXPORT_FORMATS = [
  {
    value: 'pdf',
    label: 'PDF Document',
    icon: FileText,
    description: 'Professional PDF report with charts and formatting'
  },
  {
    value: 'excel',
    label: 'Excel Spreadsheet',
    icon: Table,
    description: 'Excel file with data sheets and charts'
  },
  {
    value: 'json',
    label: 'JSON Data',
    icon: BarChart3,
    description: 'Raw data in JSON format for developers'
  }
];

const COLOR_SCHEMES = [
  { value: 'default', label: 'Default Blue', color: '#3b82f6' },
  { value: 'green', label: 'Green', color: '#10b981' },
  { value: 'purple', label: 'Purple', color: '#8b5cf6' },
  { value: 'orange', label: 'Orange', color: '#f59e0b' },
  { value: 'red', label: 'Red', color: '#ef4444' }
];

export default function ExportDialog({ reportId, open, onClose }: ExportDialogProps) {
  const { exportReport } = useReporting();
  const [loading, setLoading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [exportComplete, setExportComplete] = useState(false);

  const [exportOptions, setExportOptions] = useState({
    format: 'pdf',
    include_charts: true,
    include_raw_data: true,
    template: 'default',
    branding: {
      logo_url: '',
      company_name: '',
      colors: {
        primary: '#3b82f6',
        accent: '#10b981'
      }
    }
  });

  const handleExport = async () => {
    setLoading(true);
    setDownloadProgress(0);
    setExportComplete(false);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setDownloadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const result = await exportReport({
        report_id: reportId,
        format: exportOptions.format as any,
        options: exportOptions
      });

      clearInterval(progressInterval);
      setDownloadProgress(100);
      setDownloadUrl(result.download_url);
      setFileName(result.file_name);
      setExportComplete(true);

    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (downloadUrl) {
      // Create a temporary link to download the file
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName || `report.${exportOptions.format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleOptionChange = (field: string, value: any) => {
    setExportOptions(prev => ({ ...prev, [field]: value }));
  };

  const handleBrandingChange = (field: string, value: any) => {
    setExportOptions(prev => ({
      ...prev,
      branding: { ...prev.branding, [field]: value }
    }));
  };

  const handleColorChange = (colorType: string, value: string) => {
    setExportOptions(prev => ({
      ...prev,
      branding: {
        ...prev.branding,
        colors: { ...prev.branding.colors, [colorType]: value }
      }
    }));
  };

  const selectedFormat = EXPORT_FORMATS.find(f => f.value === exportOptions.format);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Download className="h-5 w-5" />
            <span>Export Report</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Format Selection */}
          <div>
            <Label className="text-base font-medium">Export Format</Label>
            <div className="grid grid-cols-1 gap-3 mt-2">
              {EXPORT_FORMATS.map((format) => {
                const IconComponent = format.icon;
                return (
                  <div
                    key={format.value}
                    className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                      exportOptions.format === format.value
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                        : 'border-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                    onClick={() => handleOptionChange('format', format.value)}
                  >
                    <div className="flex items-center space-x-3">
                      <IconComponent className="h-5 w-5 text-blue-600" />
                      <div className="flex-1">
                        <div className="font-medium">{format.label}</div>
                        <div className="text-sm text-muted-foreground">
                          {format.description}
                        </div>
                      </div>
                      {exportOptions.format === format.value && (
                        <CheckCircle className="h-5 w-5 text-blue-600" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Content Options */}
          <div>
            <Label className="text-base font-medium">Content Options</Label>
            <div className="space-y-3 mt-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include_charts"
                  checked={exportOptions.include_charts}
                  onCheckedChange={(checked) => handleOptionChange('include_charts', checked)}
                />
                <Label htmlFor="include_charts">Include Charts and Visualizations</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include_raw_data"
                  checked={exportOptions.include_raw_data}
                  onCheckedChange={(checked) => handleOptionChange('include_raw_data', checked)}
                />
                <Label htmlFor="include_raw_data">Include Raw Data Tables</Label>
              </div>
            </div>
          </div>

          {/* Branding Options for PDF */}
          {exportOptions.format === 'pdf' && (
            <>
              <Separator />
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 text-lg">
                    <Building className="h-5 w-5" />
                    <span>Branding</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="company_name">Company Name</Label>
                    <Input
                      id="company_name"
                      value={exportOptions.branding.company_name}
                      onChange={(e) => handleBrandingChange('company_name', e.target.value)}
                      placeholder="Your Company Name"
                    />
                  </div>

                  <div>
                    <Label htmlFor="logo_url">Logo URL</Label>
                    <Input
                      id="logo_url"
                      value={exportOptions.branding.logo_url}
                      onChange={(e) => handleBrandingChange('logo_url', e.target.value)}
                      placeholder="https://your-domain.com/logo.png"
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Color Scheme</Label>
                    <div className="grid grid-cols-5 gap-2 mt-2">
                      {COLOR_SCHEMES.map((scheme) => (
                        <div
                          key={scheme.value}
                          className={`p-2 border rounded cursor-pointer text-center transition-colors ${
                            exportOptions.branding.colors.primary === scheme.color
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:bg-gray-50'
                          }`}
                          onClick={() => handleColorChange('primary', scheme.color)}
                        >
                          <div
                            className="w-6 h-6 rounded mx-auto mb-1"
                            style={{ backgroundColor: scheme.color }}
                          />
                          <div className="text-xs">{scheme.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Export Progress */}
          {loading && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium">
                    Generating {selectedFormat?.label}...
                  </span>
                </div>
                <Progress value={downloadProgress} className="w-full" />
                <div className="text-xs text-muted-foreground">
                  {downloadProgress}% complete
                </div>
              </div>
            </>
          )}

          {/* Download Ready */}
          {exportComplete && downloadUrl && (
            <>
              <Separator />
              <Card className="border-green-200 bg-green-50 dark:bg-green-950">
                <CardContent className="pt-6">
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                    <div className="flex-1">
                      <h3 className="font-medium text-green-900 dark:text-green-100">
                        Export Complete!
                      </h3>
                      <p className="text-sm text-green-700 dark:text-green-200">
                        Your {selectedFormat?.label} is ready for download.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center space-x-2">
                    <Badge variant="outline" className="bg-white">
                      {fileName}
                    </Badge>
                    <Button size="sm" onClick={handleDownload}>
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {exportComplete ? 'Close' : 'Cancel'}
          </Button>
          {!exportComplete && (
            <Button onClick={handleExport} disabled={loading}>
              {loading ? 'Exporting...' : `Export ${selectedFormat?.label}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}