import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { EmailTemplate, EmailTemplateType } from '~backend/agent/types';

interface EmailTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: EmailTemplate[];
}

export default function EmailTemplateDialog({
  open,
  onOpenChange,
  templates,
}: EmailTemplateDialogProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);

  const getTemplateTypeColor = (type: EmailTemplateType) => {
    switch (type) {
      case 'business_builder':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'product_customer':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'initial_outreach':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'follow_up':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
    }
  };

  const templatesByType = templates.reduce((acc, template) => {
    if (!acc[template.template_type]) {
      acc[template.template_type] = [];
    }
    acc[template.template_type].push(template);
    return acc;
  }, {} as Record<EmailTemplateType, EmailTemplate[]>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Email Templates</DialogTitle>
          <DialogDescription>
            View and manage your Nu Skin outreach email templates
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[60vh]">
          <div>
            <h3 className="font-semibold mb-4">Template Library</h3>
            <ScrollArea className="h-full">
              <Tabs defaultValue="business_builder" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="business_builder">Business</TabsTrigger>
                  <TabsTrigger value="product_customer">Product</TabsTrigger>
                </TabsList>
                
                <TabsContent value="business_builder" className="space-y-2 mt-4">
                  {templatesByType.business_builder?.map((template) => (
                    <Card 
                      key={template.id} 
                      className={`cursor-pointer transition-colors ${
                        selectedTemplate?.id === template.id 
                          ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950' 
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                      onClick={() => setSelectedTemplate(template)}
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">{template.name}</CardTitle>
                        <Badge className={getTemplateTypeColor(template.template_type)}>
                          {template.template_type.replace('_', ' ')}
                        </Badge>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                          {template.subject}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </TabsContent>
                
                <TabsContent value="product_customer" className="space-y-2 mt-4">
                  {templatesByType.product_customer?.map((template) => (
                    <Card 
                      key={template.id} 
                      className={`cursor-pointer transition-colors ${
                        selectedTemplate?.id === template.id 
                          ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950' 
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                      onClick={() => setSelectedTemplate(template)}
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">{template.name}</CardTitle>
                        <Badge className={getTemplateTypeColor(template.template_type)}>
                          {template.template_type.replace('_', ' ')}
                        </Badge>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                          {template.subject}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </TabsContent>
              </Tabs>
            </ScrollArea>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Template Preview</h3>
            {selectedTemplate ? (
              <ScrollArea className="h-full">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-1">
                      Subject Line
                    </h4>
                    <p className="text-sm bg-gray-100 dark:bg-gray-800 p-3 rounded">
                      {selectedTemplate.subject}
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-1">
                      Email Body
                    </h4>
                    <div className="text-sm bg-gray-100 dark:bg-gray-800 p-3 rounded whitespace-pre-wrap">
                      {selectedTemplate.body}
                    </div>
                  </div>
                  
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded">
                    <h4 className="font-medium text-sm text-yellow-800 dark:text-yellow-200 mb-1">
                      Template Variables
                    </h4>
                    <ul className="text-xs text-yellow-700 dark:text-yellow-300 space-y-1">
                      <li>• <code>{'{{name}}'}</code> - Prospect's name</li>
                      <li>• <code>{'{{company}}'}</code> - Prospect's company</li>
                      <li>• <code>{'{{position}}'}</code> - Prospect's position</li>
                      <li>• <code>{'{{agent_name}}'}</code> - Your name</li>
                    </ul>
                  </div>
                </div>
              </ScrollArea>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                Select a template to preview
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
