"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { UploadJob, MappingProfile, Site } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { format } from "date-fns";

export default function UploadsPage() {
  const queryClient = useQueryClient();
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isMappingDialogOpen, setIsMappingDialogOpen] = useState(false);

  const [uploadForm, setUploadForm] = useState({
    siteId: "",
    filename: "",
    mappingProfileId: "",
  });

  const [newMapping, setNewMapping] = useState({
    name: "",
    siteId: "",
    sourceColumns: [
      "Coal Consumption (MT)",
      "Grid Import (kWh)",
      "Production (T)",
    ],
    targetFields: ["activity.fuel.coal.mt", "grid_import_kwh", "production_t"],
  });

  const { data: uploads, isLoading: uploadsLoading } = useQuery<UploadJob[]>({
    queryKey: ["uploads"],
    queryFn: async () => {
      const res = await fetch("/api/uploads");
      return res.json();
    },
  });

  const { data: mappings } = useQuery<MappingProfile[]>({
    queryKey: ["mappings"],
    queryFn: async () => {
      const res = await fetch("/api/mappings");
      return res.json();
    },
  });

  const { data: sites } = useQuery<Site[]>({
    queryKey: ["sites"],
    queryFn: async () => {
      const { plantsApi } = await import("@/lib/api/plants");
      const response = await plantsApi.getAll();
      if (response.success && response.data) {
        return response.data;
      }
      return [];
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (data: typeof uploadForm) => {
      const res = await fetch("/api/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["uploads"] });
      toast.success("Upload started. Processing data...");
      setIsUploadDialogOpen(false);
      setUploadForm({ siteId: "", filename: "", mappingProfileId: "" });
    },
  });

  const createMappingMutation = useMutation({
    mutationFn: async (mapping: Omit<MappingProfile, "id">) => {
      const res = await fetch("/api/mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mapping),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mappings"] });
      toast.success("Mapping profile created");
      setIsMappingDialogOpen(false);
    },
  });

  const handleUpload = () => {
    if (!uploadForm.siteId || !uploadForm.filename) {
      toast.error("Please select a site and enter filename");
      return;
    }
    uploadMutation.mutate(uploadForm);
  };

  const handleCreateMapping = () => {
    if (!newMapping.name || !newMapping.siteId) {
      toast.error("Please fill in all fields");
      return;
    }

    const columnMap: Record<string, string> = {};
    newMapping.sourceColumns.forEach((col, idx) => {
      columnMap[col] = newMapping.targetFields[idx];
    });

    createMappingMutation.mutate({
      name: newMapping.name,
      siteId: newMapping.siteId,
      columnMap,
    });
  };

  return (
    <div className="min-h-screen bg-white px-16 py-12">
      {/* Header */}
      <div className="mb-16">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-light tracking-tight text-[#0A0A0A] mb-3">
              Data Uploads
            </h1>
            <p className="text-sm text-[#0A0A0A]/60 font-light">
              Upload activity data and manage column mappings
            </p>
          </div>
          <div className="flex gap-4">
            <Dialog
              open={isMappingDialogOpen}
              onOpenChange={setIsMappingDialogOpen}
            >
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="border-[#074D47]/20 text-[#074D47] hover:bg-[#074D47]/5 hover:border-[#074D47]/40"
                >
                  New Mapping
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl bg-white">
                <DialogHeader>
                  <DialogTitle className="text-xl font-light text-[#0A0A0A]">
                    Create Mapping Profile
                  </DialogTitle>
                  <DialogDescription className="text-sm text-[#0A0A0A]/60 font-light">
                    Map source columns to canonical fields
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-6 pt-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-[#0A0A0A]/80 uppercase tracking-wide">
                      Profile Name
                    </Label>
                    <Input
                      value={newMapping.name}
                      onChange={(e) =>
                        setNewMapping({ ...newMapping, name: e.target.value })
                      }
                      placeholder="Standard Cement Template"
                      className="h-12 bg-white border-[#0A0A0A]/10 focus:border-[#074D47]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-[#0A0A0A]/80 uppercase tracking-wide">
                      Site
                    </Label>
                    <Select
                      value={newMapping.siteId}
                      onValueChange={(value) =>
                        setNewMapping({ ...newMapping, siteId: value })
                      }
                    >
                      <SelectTrigger className="h-12 bg-white border-[#0A0A0A]/10">
                        <SelectValue placeholder="Select site" />
                      </SelectTrigger>
                      <SelectContent>
                        {sites?.map((site) => (
                          <SelectItem key={site.id} value={site.id}>
                            {site.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="pt-2 pb-1">
                    <p className="text-xs text-[#0A0A0A]/50 font-light">
                      Default mappings will be created. You can customize them
                      later.
                    </p>
                  </div>
                  <Button
                    onClick={handleCreateMapping}
                    className="w-full h-12 bg-[#074D47] hover:bg-[#22867C] text-white"
                  >
                    Create Profile
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog
              open={isUploadDialogOpen}
              onOpenChange={setIsUploadDialogOpen}
            >
              <DialogTrigger asChild>
                <Button className="bg-[#074D47] hover:bg-[#22867C] text-white">
                  Upload Data
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl bg-white">
                <DialogHeader>
                  <DialogTitle className="text-xl font-light text-[#0A0A0A]">
                    Upload Activity Data
                  </DialogTitle>
                  <DialogDescription className="text-sm text-[#0A0A0A]/60 font-light">
                    Select site and mapping profile for your data file
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-6 pt-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-[#0A0A0A]/80 uppercase tracking-wide">
                      Site
                    </Label>
                    <Select
                      value={uploadForm.siteId}
                      onValueChange={(value) =>
                        setUploadForm({ ...uploadForm, siteId: value })
                      }
                    >
                      <SelectTrigger className="h-12 bg-white border-[#0A0A0A]/10">
                        <SelectValue placeholder="Select site" />
                      </SelectTrigger>
                      <SelectContent>
                        {sites?.map((site) => (
                          <SelectItem key={site.id} value={site.id}>
                            {site.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-[#0A0A0A]/80 uppercase tracking-wide">
                      Filename
                    </Label>
                    <Input
                      value={uploadForm.filename}
                      onChange={(e) =>
                        setUploadForm({
                          ...uploadForm,
                          filename: e.target.value,
                        })
                      }
                      placeholder="Site1_Q1_2024.xlsx"
                      className="h-12 bg-white border-[#0A0A0A]/10 focus:border-[#074D47]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-[#0A0A0A]/80 uppercase tracking-wide">
                      Mapping Profile{" "}
                      <span className="text-[#0A0A0A]/40">(Optional)</span>
                    </Label>
                    <Select
                      value={uploadForm.mappingProfileId}
                      onValueChange={(value) =>
                        setUploadForm({
                          ...uploadForm,
                          mappingProfileId: value,
                        })
                      }
                    >
                      <SelectTrigger className="h-12 bg-white border-[#0A0A0A]/10">
                        <SelectValue placeholder="Select mapping" />
                      </SelectTrigger>
                      <SelectContent>
                        {mappings
                          ?.filter(
                            (m) => !m.siteId || m.siteId === uploadForm.siteId,
                          )
                          .map((mapping) => (
                            <SelectItem key={mapping.id} value={mapping.id}>
                              {mapping.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={handleUpload}
                    className="w-full h-12 bg-[#074D47] hover:bg-[#22867C] text-white"
                  >
                    Start Upload
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-3 gap-8 mb-16">
        <div className="border border-[#0A0A0A]/10 p-8">
          <div className="text-xs font-medium text-[#0A0A0A]/60 uppercase tracking-wide mb-4">
            Total Uploads
          </div>
          <div className="text-4xl font-light text-[#0A0A0A]">
            {uploads?.length || 0}
          </div>
        </div>
        <div className="border border-[#0A0A0A]/10 p-8">
          <div className="text-xs font-medium text-[#0A0A0A]/60 uppercase tracking-wide mb-4">
            Processing
          </div>
          <div className="text-4xl font-light text-[#22867C]">
            {uploads?.filter((u) => u.status === "Processing").length || 0}
          </div>
        </div>
        <div className="border border-[#0A0A0A]/10 p-8">
          <div className="text-xs font-medium text-[#0A0A0A]/60 uppercase tracking-wide mb-4">
            Mapping Profiles
          </div>
          <div className="text-4xl font-light text-[#0A0A0A]">
            {mappings?.length || 0}
          </div>
        </div>
      </div>

      {/* Upload History */}
      <div className="mb-16">
        <h2 className="text-base font-medium text-[#0A0A0A] mb-6 uppercase tracking-wide">
          Recent Uploads
        </h2>
        <div className="border border-[#0A0A0A]/10">
          <Table>
            <TableHeader>
              <TableRow className="border-[#0A0A0A]/10 hover:bg-transparent">
                <TableHead className="text-xs font-medium text-[#0A0A0A]/60 uppercase tracking-wide h-14">
                  Filename
                </TableHead>
                <TableHead className="text-xs font-medium text-[#0A0A0A]/60 uppercase tracking-wide h-14">
                  Site
                </TableHead>
                <TableHead className="text-xs font-medium text-[#0A0A0A]/60 uppercase tracking-wide h-14">
                  Status
                </TableHead>
                <TableHead className="text-xs font-medium text-[#0A0A0A]/60 uppercase tracking-wide h-14 text-right">
                  Ingested
                </TableHead>
                <TableHead className="text-xs font-medium text-[#0A0A0A]/60 uppercase tracking-wide h-14 text-right">
                  Rejected
                </TableHead>
                <TableHead className="text-xs font-medium text-[#0A0A0A]/60 uppercase tracking-wide h-14 text-right">
                  Uploaded
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {uploadsLoading ? (
                <TableRow className="border-[#0A0A0A]/10 hover:bg-[#074D47]/5">
                  <TableCell
                    colSpan={6}
                    className="text-center py-16 text-[#0A0A0A]/40 font-light"
                  >
                    Loading uploads...
                  </TableCell>
                </TableRow>
              ) : uploads && uploads.length > 0 ? (
                uploads.map((upload) => (
                  <TableRow
                    key={upload.id}
                    className="border-[#0A0A0A]/10 hover:bg-[#074D47]/5"
                  >
                    <TableCell className="font-light text-[#0A0A0A] h-16">
                      {upload.filename}
                    </TableCell>
                    <TableCell className="text-sm font-light text-[#0A0A0A]/70 h-16">
                      {upload.siteId}
                    </TableCell>
                    <TableCell className="h-16">
                      <span
                        className={`text-xs font-medium uppercase tracking-wide ${
                          upload.status === "Completed"
                            ? "text-[#22867C]"
                            : upload.status === "Failed"
                              ? "text-[#0A0A0A]/40"
                              : "text-[#074D47]"
                        }`}
                      >
                        {upload.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-light text-[#22867C] h-16">
                      {upload.rowsIngested}
                    </TableCell>
                    <TableCell
                      className={`text-right font-light h-16 ${
                        upload.rowsRejected > 0
                          ? "text-[#0A0A0A]/40"
                          : "text-[#0A0A0A]/20"
                      }`}
                    >
                      {upload.rowsRejected}
                    </TableCell>
                    <TableCell className="text-right text-sm font-light text-[#0A0A0A]/50 h-16">
                      {format(new Date(upload.uploadedAt), "MMM dd, yyyy HH:mm")}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow className="border-[#0A0A0A]/10 hover:bg-[#074D47]/5">
                  <TableCell
                    colSpan={6}
                    className="text-center py-16 text-[#0A0A0A]/40 font-light"
                  >
                    No uploads yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Mapping Profiles */}
      <div>
        <h2 className="text-base font-medium text-[#0A0A0A] mb-6 uppercase tracking-wide">
          Mapping Profiles
        </h2>
        <div className="space-y-1">
          {mappings && mappings.length > 0 ? (
            mappings.map((mapping) => (
              <div
                key={mapping.id}
                className="border border-[#0A0A0A]/10 p-6 hover:bg-[#074D47]/5 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-light text-[#0A0A0A] mb-2">
                      {mapping.name}
                    </div>
                    <div className="text-xs text-[#0A0A0A]/50 font-light">
                      {Object.keys(mapping.columnMap).length} column mappings
                      {mapping.siteId && ` • Site: ${mapping.siteId}`}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-[#074D47]/20 text-[#074D47] hover:bg-[#074D47]/5 hover:border-[#074D47]/40"
                  >
                    View Details
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="border border-[#0A0A0A]/10 p-16 text-center">
              <p className="text-[#0A0A0A]/40 font-light">
                No mapping profiles created yet
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
