<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lienzo_sites', function (Blueprint $table) {
            $table->id();
            $table->nullableMorphs('owner');
            $table->string('name', 120);
            $table->string('locale', 10)->nullable();
            $table->json('theme')->nullable();
            $table->json('seo')->nullable();
            $table->string('favicon', 500)->nullable();
            $table->string('og_image', 500)->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->unique(['owner_type', 'owner_id']);
        });

        Schema::create('lienzo_pages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('site_id')->constrained('lienzo_sites')->cascadeOnDelete();
            $table->string('slug', 120)->default('');
            $table->string('title', 120);
            $table->json('seo')->nullable();
            $table->json('draft');
            $table->unsignedInteger('revision')->default(1);
            $table->json('published')->nullable();
            $table->string('published_slug', 120)->nullable();
            $table->json('published_seo')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->nullableMorphs('published_by');
            $table->timestamps();

            $table->unique(['site_id', 'slug']);
            $table->unique(['site_id', 'published_slug']);
        });

        Schema::create('lienzo_page_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('page_id')->constrained('lienzo_pages')->cascadeOnDelete();
            $table->json('document');
            $table->nullableMorphs('created_by');
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('lienzo_assets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('site_id')->constrained('lienzo_sites')->cascadeOnDelete();
            $table->string('name', 160);
            $table->string('path');
            $table->string('thumb_path')->nullable();
            $table->string('mime', 60);
            $table->unsignedInteger('size');
            $table->unsignedSmallInteger('width')->nullable();
            $table->unsignedSmallInteger('height')->nullable();
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('lienzo_submissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('site_id')->constrained('lienzo_sites')->cascadeOnDelete();
            $table->string('page', 120);
            $table->string('source', 40);
            $table->json('fields');
            $table->string('ip', 45)->nullable();
            $table->timestamp('created_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lienzo_submissions');
        Schema::dropIfExists('lienzo_assets');
        Schema::dropIfExists('lienzo_page_versions');
        Schema::dropIfExists('lienzo_pages');
        Schema::dropIfExists('lienzo_sites');
    }
};
