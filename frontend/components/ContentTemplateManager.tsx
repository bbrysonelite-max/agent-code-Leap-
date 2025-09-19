import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Edit, Trash2, Copy, Eye, Tag } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function ContentTemplateManager() {
  const [templates, setTemplates] = useState([
    {
      id: '1',
      name: 'Welcome Email',
      type: 'email',
      subject: 'Welcome to our platform!',
      content: 'Hi {{firstName}}, welcome to our platform...',
      tags: ['onboarding', 'welcome'],
      created_at: new Date(),
      updated_at: new Date()
    }
  ]);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [previewData, setPreviewData] = useState({
    firstName: 'John',
    company: 'Acme Corp',
    classification: 'High Value'
  });

  const { toast } = useToast();

  const handleCreateTemplate = () => {
    toast({ title: 'Template created successfully' });
    setIsCreateDialogOpen(false);
  };

  const handleEditTemplate = () => {
    toast({ title: 'Template updated successfully' });
    setIsEditDialogOpen(false);
  };

  const handleDeleteTemplate = (id: string) => {
    setTemplates(templates.filter(t => t.id !== id));
    toast({ title: 'Template deleted successfully' });
  };

  const renderPreview = (content: string) => {
    let rendered = content;
    Object.entries(previewData).forEach(([key, value]) => {
      rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), value.toString());
    });
    return rendered;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Content Templates</h2>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Template</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Template Name</Label>
                <Input placeholder="Enter template name..." />
              </div>
              <div>
                <Label>Subject (for emails)</Label>
                <Input placeholder="Enter email subject..." />
              </div>
              <div>
                <Label>Content</Label>
                <Textarea 
                  placeholder="Enter template content..." 
                  className="min-h-[200px]"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreateTemplate}>Create Template</Button>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {templates.map((template) => (
          <Card key={template.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                  <div className="flex gap-2 mt-2">
                    {template.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        <Tag className="h-3 w-3 mr-1" />
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm">
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleDeleteTemplate(template.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>
                  <Label className="text-sm font-medium">Subject:</Label>
                  <p className="text-sm text-gray-600">{template.subject}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Content Preview:</Label>
                  <p className="text-sm text-gray-600 line-clamp-3">
                    {renderPreview(template.content)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}